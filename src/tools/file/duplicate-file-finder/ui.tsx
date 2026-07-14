"use client";
import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ShareButton, ErrorBanner, EmptyState, RunButton } from "../../_shared";
import {
  findDuplicates, buildFileEntries, formatBytes, groupsToCsv, groupsToJson,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type FileEntry, type DuplicateGroup, type ScanStats, type ScanOptions, type SortKey, type DupHistoryEntry,
} from "./logic";
import { Upload, Files, X, History, Copy, Download, Share2 } from "lucide-react";
import { toast } from "sonner";

export default function DuplicateFileFinder() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [options, setOptions] = useState<ScanOptions>({ minSizeBytes: 0, sortKey: "size", sortDir: "desc" });
  const [minSizeKb, setMinSizeKb] = useState(0);
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("");
  const [groups, setGroups] = useState<DuplicateGroup[] | null>(null);
  const [stats, setStats] = useState<ScanStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DupHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);

  // Restore settings from URL fragment
  useEffect(() => {
    if (typeof window === "undefined") return;
    const h = window.location.hash;
    if (!h) return;
    const params = new URLSearchParams(h.slice(1));
    if (params.has("min")) {
      const minBytes = parseInt(params.get("min")!);
      setMinSizeKb(Math.floor(minBytes / 1024));
      setOptions((o) => ({ ...o, minSizeBytes: minBytes }));
    }
    if (params.has("sort")) setOptions((o) => ({ ...o, sortKey: params.get("sort") as SortKey }));
    if (params.has("dir")) setOptions((o) => ({ ...o, sortDir: params.get("dir") as "asc" | "desc" }));
  }, []);

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList);
    const entries = buildFileEntries(arr);
    setFiles((prev) => [...prev, ...entries]);
    setGroups(null);
    setStats(null);
  }, []);

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const onMinSizeChange = (kb: number) => {
    setMinSizeKb(kb);
    setOptions((o) => ({ ...o, minSizeBytes: kb * 1024 }));
  };

  const onSortKeyChange = (key: SortKey) => {
    setOptions((o) => ({ ...o, sortKey: key }));
  };

  const onSortDirChange = (dir: "asc" | "desc") => {
    setOptions((o) => ({ ...o, sortDir: dir }));
  };

  const runScan = useCallback(async () => {
    if (files.length < 2) {
      toast.error("Add at least 2 files to compare");
      return;
    }
    setWorking(true);
    setError(null);
    setProgress(0);
    setPhase("Starting…");
    try {
      // Deep-copy file entries so we don't mutate state hashes
      const entries: FileEntry[] = files.map((f) => ({ ...f, file: f.file }));
      const { groups: g, stats: s } = await findDuplicates(entries, options, (pct, ph) => {
        setProgress(pct);
        setPhase(ph);
      });
      setGroups(g);
      setStats(s);
      const entry: DupHistoryEntry = {
        fileCount: files.length,
        duplicateGroups: s.duplicateGroups,
        spaceSaved: s.spaceSaved,
        scannedAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setPhase("");
      setTimeout(() => setProgress(0), 800);
    }
  }, [files, options]);

  const downloadJson = useCallback(() => {
    if (!groups || !stats) return;
    const json = groupsToJson(groups, stats);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "duplicates.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("Downloaded duplicates.json");
  }, [groups, stats]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="dup-find-input"
            aria-label="Choose files to scan for duplicates"
          />
          <button
            type="button"
            onClick={() => document.getElementById("dup-find-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · SHA-256 comparison · partial-hash quick filter</p>
          </button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Files ({files.length})</Label>
              <button type="button" onClick={() => { setFiles([]); setGroups(null); setStats(null); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear all</button>
            </div>
            <div className="space-y-1 max-h-[240px] overflow-y-auto">
              {files.map((f) => (
                <div key={f.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                  <span className="truncate font-mono" title={f.relativePath ?? f.name}>{f.relativePath ?? f.name}</span>
                  <Badge variant="outline" className="text-[9px]">{formatBytes(f.size)}</Badge>
                  <button type="button" onClick={() => removeFile(f.id)} aria-label={`Remove ${f.name}`} className="text-muted-foreground hover:text-red-600 cursor-pointer"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Scan options</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Min size (KB)</label>
                <Input type="number" min={0} value={minSizeKb} onChange={(e) => onMinSizeChange(Math.max(0, parseInt(e.target.value) || 0))} className="h-8 text-xs" aria-label="Minimum size in KB" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Sort by</label>
                <select value={options.sortKey} onChange={(e) => onSortKeyChange(e.target.value as SortKey)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Sort key">
                  <option value="size">Size</option>
                  <option value="name">Name</option>
                  <option value="date">Date</option>
                  <option value="none">None</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground">Direction</label>
                <select value={options.sortDir} onChange={(e) => onSortDirChange(e.target.value as "asc" | "desc")} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Sort direction">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
              <div className="space-y-1 flex items-end">
                <RunButton onClick={runScan} disabled={working || files.length < 2} loading={working} label="Scan" size="sm" />
              </div>
            </div>
            {working && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{phase}</span>
                  <span className="font-mono">{progress}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-200" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Stats</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total files</p><p className="font-mono font-semibold">{stats.totalFiles}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Total size</p><p className="font-mono font-semibold">{formatBytes(stats.totalSize)}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Duplicate groups</p><p className="font-mono font-semibold">{stats.duplicateGroups}</p></div>
              <div className="rounded-md border p-2"><p className="text-[10px] text-muted-foreground">Space saved</p><p className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">{formatBytes(stats.spaceSaved)}</p></div>
            </div>
            {(stats.skippedBySize > 0 || stats.skippedByPartial > 0) && (
              <p className="text-[10px] text-muted-foreground">Skipped by size filter: {stats.skippedBySize} · Skipped by partial-hash: {stats.skippedByPartial}</p>
            )}
          </CardContent>
        </Card>
      )}

      {groups && groups.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Duplicate groups ({groups.length})</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => groupsToCsv(groups)} label="Copy CSV" size="sm" />
                <DownloadButton getText={() => groupsToCsv(groups)} filename="duplicates.csv" mime="text/csv" label="CSV" size="sm" />
                <button type="button" onClick={downloadJson} className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-xs cursor-pointer hover:bg-muted/30">
                  <Download className="h-3 w-3" /> JSON
                </button>
                <ShareButton getUrl={() => buildShareUrl(options)} label="" size="icon-sm" />
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1">
                  <History className="h-3 w-3" /> ({history.length})
                </button>
              </div>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {groups.map((g, gi) => (
                <div key={gi} className="rounded-md border border-border/60 p-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground truncate" title={g.hash}>#{gi + 1} · {g.hash.slice(0, 16)}…</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">{formatBytes(g.size)} each</Badge>
                      <Badge variant="outline" className="text-[9px] text-emerald-600 dark:text-emerald-400">saves {formatBytes(g.spaceSaved)}</Badge>
                      <Badge variant="outline" className="text-[9px]">{g.members.length} copies</Badge>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {g.members.map((m, mi) => (
                      <div key={m.id} className="grid grid-cols-[auto_1fr_auto] gap-2 items-center text-xs py-0.5">
                        <span className="text-[10px] text-muted-foreground font-mono w-6">{mi === 0 ? "★" : ""}</span>
                        <span className="truncate font-mono" title={m.relativePath ?? m.name}>{m.relativePath ?? m.name}</span>
                        <Badge variant="outline" className="text-[9px]">{new Date(m.lastModified).toLocaleDateString()}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {groups && groups.length === 0 && stats && (
        <Card><CardContent className="p-4 text-center">
          <Files className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
          <p className="text-sm font-medium">No duplicates found</p>
          <p className="text-xs text-muted-foreground mt-1">All {stats.totalFiles} files are unique.</p>
        </CardContent></Card>
      )}

      {showHistory && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">History ({history.length})</Label>
              {history.length > 0 && (
                <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                    <p className="font-medium">{h.fileCount} files · {h.duplicateGroups} dup groups</p>
                    <p className="text-[10px] text-muted-foreground">saved {formatBytes(h.spaceSaved)} · {new Date(h.scannedAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {files.length === 0 && !error && (
        <EmptyState
          title="Drop files to find duplicates"
          hint="Compares file size + SHA-256 hash. Partial-hash (4KB) for speed, full-hash for confirmation. Stats + CSV/JSON export. 100% local."
          icon={<Files className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all hashing runs in your browser via WebCrypto. Your files never leave your device.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
