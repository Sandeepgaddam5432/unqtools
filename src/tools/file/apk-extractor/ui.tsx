"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  parseApk, decompressEntry, isZipArchive, classifyApkFile,
  buildFileTree, searchEntries, filterByType,
  computeStats, detectMimeFromName,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildZipFromEntries,
  type ApkEntry, type ApkStats, type TreeNode, type ApkFilter,
  type AppInfo, type HistoryEntry, type ApkParseResult,
} from "./logic";
import {
  Upload, Smartphone, Download, History, BarChart3, X, Eye,
  ChevronRight, ChevronDown, File as FileIcon, Folder, FolderOpen, Search,
  Package, Shield, FileCode, Image as ImageIcon,
} from "lucide-react";

export default function ApkExtractor() {
  const [apk, setApk] = useState<ApkParseResult | null>(null);
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ApkFilter>("all");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set([""]));
  const [showPermissions, setShowPermissions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const file = fileList[0]!;
    setError(null);
    setWorking(true);
    try {
      const fileBytes = new Uint8Array(await file.arrayBuffer());
      if (!isZipArchive(fileBytes)) {
        setError(`${file.name}: not a valid APK file (missing ZIP signature).`);
        setApk(null);
        return;
      }
      const result = await parseApk(fileBytes, file.name);
      setApk(result);
      setBytes(fileBytes);
      setHistory(saveToHistory({
        fileName: file.name,
        fileSize: result.fileSize,
        packageName: result.appInfo.packageName,
        versionName: result.appInfo.versionName,
        entryCount: result.stats.entryCount,
        permissionCount: result.appInfo.permissions.length,
        inspectedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${result.stats.entryCount} entries from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setApk(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredEntries = useMemo(() => {
    if (!apk) return [];
    return filterByType(searchEntries(apk.entries, search), filter);
  }, [apk, search, filter]);

  const filteredTree = useMemo(() => buildFileTree(filteredEntries), [filteredEntries]);

  const togglePath = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const downloadEntry = useCallback(async (entry: ApkEntry) => {
    if (!bytes) return;
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
  }, [bytes]);

  const downloadAllZip = useCallback(async () => {
    if (!apk) return;
    try {
      const blob = await buildZipFromEntries(apk.entries);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${apk.fileName.replace(/\.apk$/i, "")}_extracted.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(`Downloaded ${apk.fileName.replace(/\.apk$/i, "")}_extracted.zip`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [apk]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".apk,application/vnd.android.package-archive"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="apk-input"
            aria-label="Choose an .apk file"
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
            <p className="text-sm font-medium">Drop an .apk file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS APK (ZIP) parser · binary AndroidManifest.xml · DEX + resources + native libs</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing APK archive...
          </CardContent>
        </Card>
      )}

      {apk && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">{apk.fileName}</Label>
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
                    onClick={() => { setApk(null); setBytes(null); setSearch(""); setFilter("all"); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Entries" value={String(apk.stats.entryCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="DEX files" value={String(apk.stats.dexCount)} icon={<FileCode className="h-3 w-3" />} />
                <Stat label="Native libs" value={String(apk.stats.nativeLibCount)} />
                <Stat label="Images" value={String(apk.stats.imageCount)} icon={<ImageIcon className="h-3 w-3" />} />
                <Stat label="Uncompressed" value={formatBytes(apk.stats.totalUncompressed)} accent />
                <Stat label="Ratio" value={formatRatio(apk.stats.ratio)} />
              </div>
            </CardContent>
          </Card>

          {apk.appInfo.manifestFound && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> App info
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <InfoRow label="Package name" value={apk.appInfo.packageName || "(not detected)"} />
                  <InfoRow label="Version name" value={apk.appInfo.versionName || "(not detected)"} />
                  <InfoRow label="Permissions" value={`${apk.appInfo.permissions.length} declared`} />
                  <InfoRow label="Manifest" value="Found (binary AXML)" />
                </div>
                {apk.appInfo.permissions.length > 0 && (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowPermissions(!showPermissions)}
                      className="text-xs text-primary hover:underline cursor-pointer"
                    >
                      {showPermissions ? "Hide" : "Show"} permission list ({apk.appInfo.permissions.length})
                    </button>
                    {showPermissions && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {apk.appInfo.permissions.map((p) => (
                          <Badge key={p} variant="outline" className="text-[10px]">
                            <Shield className="h-2.5 w-2.5 mr-1" />
                            {p.replace("android.permission.", "")}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

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
                  onChange={(e) => setFilter(e.target.value as ApkFilter)}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                  aria-label="Filter by type"
                >
                  <option value="all">All files</option>
                  <option value="dex">DEX files</option>
                  <option value="resources">Resources</option>
                  <option value="native-lib">Native libs</option>
                  <option value="asset">Assets</option>
                  <option value="image">Images</option>
                  <option value="signature">Signatures</option>
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
                    depth={0}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!apk && !error && !working && (
        <EmptyState
          title="Inspect Android APK files"
          hint="Pure-JS APK (ZIP) parser. View AndroidManifest.xml (binary AXML), list DEX files, resources, native libs. Extract individual files or re-zip as standard ZIP."
          icon={<Smartphone className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recent APKs</Label>
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
                        {h.packageName || "(unknown package)"} · v{h.versionName || "?"} · {h.entryCount} entries · {h.permissionCount} perms · {formatBytes(h.fileSize)}
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
            <strong className="text-foreground">Privacy:</strong> all APK parsing runs in your browser using pure JavaScript. File contents never leave your device.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <strong>Honesty clause:</strong> we parse the AXML string pool (package name + permissions + version name) but not the full XML tree, so version code, minSdkVersion, and targetSdkVersion may be empty. Use `aapt` or `apktool` for full manifest decoding.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function TreeView({
  node, expandedPaths, togglePath, onDownload, depth,
}: {
  node: TreeNode;
  expandedPaths: Set<string>;
  togglePath: (path: string) => void;
  onDownload: (entry: ApkEntry) => void;
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
                      {entry.apkType}
                    </Badge>
                  )}
                </div>
              )}
              {!child.isDirectory && entry && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-muted-foreground">{formatBytes(entry.uncompressedSize)}</span>
                  {entry.isExtractable && (
                    <button
                      type="button"
                      onClick={() => onDownload(entry)}
                      className="p-0.5 rounded hover:bg-accent cursor-pointer"
                      aria-label={`Download ${child.name}`}
                      title="Download"
                    >
                      <Download className="h-3 w-3" />
                    </button>
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-sm font-mono">{value}</span>
    </div>
  );
}
