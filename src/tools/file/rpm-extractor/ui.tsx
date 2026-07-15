"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  extractRpm, extractCpioEntry, buildFileTree, buildZipFromCpio,
  computeStats, detectMimeFromName, previewFile, searchEntries, filterByType,
  formatBytes, formatMode, formatMtime,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type CpioEntry, type RpmStats, type TreeNode, type FileTypeFilter,
  type RpmExtractResult, type HistoryEntry,
} from "./logic";
import {
  Upload, Package, Download, History, BarChart3, X, Eye,
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, Search,
} from "lucide-react";

interface ArchiveData {
  fileName: string;
  size: number;
  result: RpmExtractResult;
}

export default function RpmExtractor() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FileTypeFilter>("all");
  const [previewEntry, setPreviewEntry] = useState<CpioEntry | null>(null);
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
      const result = await extractRpm(bytes);
      if (!result.ok) {
        setError(`${file.name}: ${result.error}`);
        setArchive(null);
        setWorking(false);
        return;
      }
      setArchive({ fileName: file.name, size: bytes.length, result: result.output });
      setHistory(saveToHistory({
        fileName: file.name,
        rpmSize: bytes.length,
        packageName: result.output.metadata.name || file.name,
        packageVersion: result.output.metadata.version,
        fileCount: result.output.stats.fileCount,
        totalExtractedSize: result.output.stats.totalExtractedSize,
        extractedAt: new Date().toISOString(),
      }));
      toast.success(`Extracted ${result.output.stats.fileCount} files from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setArchive(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!archive) return [];
    return filterByType(searchEntries(archive.result.entries, search), filter);
  }, [archive, search, filter]);

  const filteredTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadEntry = useCallback((entry: CpioEntry) => {
    if (!archive) return;
    const data = extractCpioEntry(archive.result.cpioBytes, entry);
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
  }, [archive]);

  const downloadAllZip = useCallback(() => {
    if (!archive) return;
    const blob = buildZipFromCpio(archive.result.cpioBytes, archive.result.entries);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.fileName.replace(/\.rpm$/i, "")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${archive.fileName.replace(/\.rpm$/i, "")}.zip`);
  }, [archive]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input type="file" accept=".rpm,application/x-rpm"
            onChange={(e) => handleFiles(e.target.files)} className="hidden" id="rpm-input"
            aria-label="Choose a .rpm file" ref={fileInputRef} />
          <button type="button" onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer">
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a .rpm file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">RPM lead + header + cpio parser · gzip-payload supported · 100% client-side</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-sm text-muted-foreground">Parsing RPM package…</CardContent></Card>
      )}

      {archive && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{archive.fileName}</Label>
                <div className="flex gap-2">
                  <button type="button" onClick={downloadAllZip}
                    className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background hover:bg-accent h-8 px-3 text-xs cursor-pointer">
                    <Download className="h-3.5 w-3.5" /> Download all as ZIP
                  </button>
                  <button type="button" onClick={() => { setArchive(null); setSearch(""); setFilter("all"); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2">Clear</button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Files" value={String(archive.result.stats.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Dirs" value={String(archive.result.stats.directoryCount)} />
                <Stat label="Symlinks" value={String(archive.result.stats.symlinkCount)} />
                <Stat label="Extracted" value={formatBytes(archive.result.stats.totalExtractedSize)} accent />
                <Stat label="RPM size" value={formatBytes(archive.size)} />
                <Stat label="Payload" value={archive.result.stats.payloadCompressed ? "gzip" : "plain"} />
              </div>
              <div className="text-[10px] text-muted-foreground">
                Lead: v{archive.result.lead.major}.{archive.result.lead.minor} · type={archive.result.lead.type === 0 ? "binary" : "source"} · name=&quot;{archive.result.lead.name}&quot;
              </div>
            </CardContent>
          </Card>

          {archive.result.metadata.name && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Package info</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <Field label="Name" value={archive.result.metadata.name} />
                  <Field label="Version" value={archive.result.metadata.version} />
                  <Field label="Release" value={archive.result.metadata.release} />
                  <Field label="Architecture" value={archive.result.metadata.architecture} />
                  <Field label="OS" value={archive.result.metadata.os} />
                  <Field label="License" value={archive.result.metadata.license} />
                </div>
                {archive.result.metadata.summary && (
                  <p className="text-xs text-muted-foreground"><strong>Summary:</strong> {archive.result.metadata.summary}</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Filter & search</Label>
                <ShareButton getUrl={() => buildShareUrl({ filter, search })} label="Share view" size="sm" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by filename…" className="pl-7" aria-label="Search entries" />
                </div>
                <select value={filter} onChange={(e) => setFilter(e.target.value as FileTypeFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer" aria-label="Filter by type">
                  <option value="all">All types</option>
                  <option value="regular">Files only</option>
                  <option value="directory">Directories only</option>
                  <option value="symlink">Symlinks only</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <p className="text-[10px] text-muted-foreground">{filteredEntries.length} match{filteredEntries.length === 1 ? "" : "es"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">File tree</Label>
              <div className="max-h-[500px] overflow-y-auto rounded-md border">
                {filteredTree.children.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matching entries.</p>
                ) : (
                  <TreeView node={filteredTree} expandedPaths={expandedPaths} togglePath={togglePath}
                    onDownload={downloadEntry} onPreview={setPreviewEntry} depth={0} />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {previewEntry && archive && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Preview: {previewEntry.name}</Label>
              <button type="button" onClick={() => setPreviewEntry(null)}
                className="p-1 rounded-md hover:bg-accent cursor-pointer" aria-label="Close preview">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {(() => {
              const data = extractCpioEntry(archive.result.cpioBytes, previewEntry);
              const preview = previewFile(data);
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <Badge variant="outline">{formatBytes(previewEntry.fileSize)}</Badge>
                    <Badge variant="outline">{detectMimeFromName(previewEntry.name)}</Badge>
                    <Badge variant="outline">mode {formatMode(previewEntry.mode)}</Badge>
                    <Badge variant="outline">mtime {formatMtime(previewEntry.mtime)}</Badge>
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

      {!archive && !error && !working && (
        <EmptyState title="Extract RPM packages"
          hint="RPM lead + header + cpio parser. Supports gzip-compressed payloads. Browse the file tree, preview files, download individual or all as ZIP."
          icon={<Package className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <button type="button" onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
            <History className="h-3 w-3" /> History ({history.length})
          </button>
          {showHistory && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Recent extractions</Label>
                {history.length > 0 && (
                  <button type="button" onClick={() => { clearHistory(); setHistory([]); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer">Clear</button>
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
                        {h.packageName}-{h.packageVersion} · {h.fileCount} files · {formatBytes(h.totalExtractedSize)} extracted · {new Date(h.extractedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all RPM parsing and cpio extraction runs in your browser. File contents never leave your device.
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-mono">{value || "—"}</p>
    </div>
  );
}

interface TreeViewProps {
  node: TreeNode;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  onDownload: (entry: CpioEntry) => void;
  onPreview: (entry: CpioEntry) => void;
  depth: number;
}

function TreeView({ node, expandedPaths, togglePath, onDownload, onPreview, depth }: TreeViewProps) {
  return (
    <ul className={depth === 0 ? "" : "ml-4 border-l border-border/40"}>
      {node.children.map((child) => {
        const isExpanded = expandedPaths.has(child.path);
        const hasChildren = child.children.length > 0;
        return (
          <li key={child.path}>
            <div className="flex items-center gap-1 px-2 py-1 hover:bg-accent/50 rounded-sm group">
              {hasChildren ? (
                <button type="button" onClick={() => togglePath(child.path)}
                  className="p-0.5 rounded hover:bg-accent cursor-pointer" aria-label={isExpanded ? "Collapse" : "Expand"}>
                  {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                </button>
              ) : (
                <span className="w-4" />
              )}
              {child.isDirectory ? (
                isExpanded ? <FolderOpen className="h-3.5 w-3.5 text-amber-500" /> : <Folder className="h-3.5 w-3.5 text-amber-500" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-blue-500" />
              )}
              <span className="text-xs flex-1 truncate">{child.name}</span>
              {child.entry && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                  <button type="button" onClick={() => onPreview(child.entry!)}
                    className="p-1 rounded hover:bg-accent cursor-pointer" aria-label="Preview">
                    <Eye className="h-3 w-3" />
                  </button>
                  <button type="button" onClick={() => onDownload(child.entry!)}
                    className="p-1 rounded hover:bg-accent cursor-pointer" aria-label="Download">
                    <Download className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            {hasChildren && isExpanded && (
              <TreeView node={child} expandedPaths={expandedPaths} togglePath={togglePath}
                onDownload={onDownload} onPreview={onPreview} depth={depth + 1} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
