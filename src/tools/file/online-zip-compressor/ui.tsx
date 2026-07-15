"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  filesToEntries, moveUp, moveDown, removeEntry, renameEntry,
  findDuplicates, sanitizeArchiveName, estimateArchiveSize,
  computeStats, buildArchive, detectMimeFromName,
  formatBytes, formatRatio,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type FileEntry, type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X,
  ArrowUp, ArrowDown, Pencil, Check, Files,
} from "lucide-react";

export default function ZipCompressor() {
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [archiveName, setArchiveName] = useState("archive");
  const [working, setWorking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    setWorking(true);
    try {
      const newEntries = await filesToEntries(fileList);
      setEntries((prev) => [...prev, ...newEntries]);
      toast.success(`Added ${newEntries.length} file${newEntries.length === 1 ? "" : "s"}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const stats = useMemo(() => computeStats(entries), [entries]);
  const duplicates = useMemo(() => findDuplicates(entries), [entries]);

  const buildZip = useCallback(() => {
    setError(null);
    setBuilding(true);
    try {
      const result = buildArchive(entries, archiveName);
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setHistory(saveToHistory({
        archiveName: result.fileName,
        fileCount: result.stats.fileCount,
        totalUncompressed: result.stats.totalUncompressed,
        archiveSize: result.stats.archiveSize,
        createdAt: new Date().toISOString(),
      }));
      toast.success(`Built ${result.fileName} (${formatBytes(result.stats.archiveSize)})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBuilding(false);
    }
  }, [entries, archiveName]);

  const startEdit = (entry: FileEntry) => {
    setEditingId(entry.id);
    setEditName(entry.name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    if (!editName.trim()) {
      toast.error("Filename cannot be empty");
      return;
    }
    setEntries((prev) => renameEntry(prev, editingId, editName.trim()));
    setEditingId(null);
    setEditName("");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="zip-input"
            aria-label="Choose files to zip"
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
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multiple files · drag-drop · reorder · STORE method (no compression)</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Reading files...
          </CardContent>
        </Card>
      )}

      {entries.length > 0 && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <Label htmlFor="archive-name" className="text-xs font-semibold">Archive name</Label>
                  <Input
                    id="archive-name"
                    value={archiveName}
                    onChange={(e) => setArchiveName(e.target.value)}
                    placeholder="archive"
                    className="mt-1"
                    aria-label="Archive name"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">.zip extension added automatically</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={buildZip}
                    disabled={building || entries.length === 0}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {building ? (
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {building ? "Building..." : "Build & download ZIP"}
                  </button>
                </div>
              </div>
              {duplicates.size > 0 && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ Duplicate filenames: {Array.from(duplicates).slice(0, 3).join(", ")}{duplicates.size > 3 ? "..." : ""}. Rename or remove before building.
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Files" value={String(stats.fileCount)} icon={<Files className="h-3 w-3" />} />
                <Stat label="Uncompressed" value={formatBytes(stats.totalUncompressed)} />
                <Stat label="Est. archive" value={formatBytes(stats.estimatedSize)} accent />
                <Stat label="Ratio" value={formatRatio(stats.ratio)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">File list ({entries.length})</Label>
                <div className="flex gap-2">
                  <ShareButton getUrl={() => buildShareUrl({ archiveName })} label="Share name" size="sm" />
                  <button
                    type="button"
                    onClick={() => { setEntries([]); setError(null); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear all
                  </button>
                </div>
              </div>
              <div className="max-h-[400px] overflow-y-auto rounded-md border divide-y divide-border/40">
                {entries.map((entry, idx) => (
                  <div key={entry.id} className="flex items-center gap-2 p-2 text-xs">
                    <span className="text-muted-foreground w-6 text-right flex-shrink-0">{idx + 1}.</span>
                    {editingId === entry.id ? (
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingId(null); }}
                        className="h-7 flex-1"
                        autoFocus
                      />
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{entry.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(entry.size)} · {entry.mime}
                        </p>
                      </div>
                    )}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setEntries((prev) => moveUp(prev, entry.id))}
                        disabled={idx === 0}
                        className="p-1 rounded hover:bg-accent cursor-pointer disabled:opacity-30"
                        aria-label={`Move ${entry.name} up`}
                        title="Move up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntries((prev) => moveDown(prev, entry.id))}
                        disabled={idx === entries.length - 1}
                        className="p-1 rounded hover:bg-accent cursor-pointer disabled:opacity-30"
                        aria-label={`Move ${entry.name} down`}
                        title="Move down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      {editingId === entry.id ? (
                        <button
                          type="button"
                          onClick={commitEdit}
                          className="p-1 rounded hover:bg-accent cursor-pointer"
                          aria-label="Save name"
                          title="Save"
                        >
                          <Check className="h-3 w-3 text-emerald-600" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(entry)}
                          className="p-1 rounded hover:bg-accent cursor-pointer"
                          aria-label={`Rename ${entry.name}`}
                          title="Rename"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setEntries((prev) => removeEntry(prev, entry.id))}
                        className="p-1 rounded hover:bg-accent cursor-pointer text-red-600"
                        aria-label={`Remove ${entry.name}`}
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {error && <ErrorBanner message={error} />}

      {!entries.length && !error && !working && (
        <EmptyState
          title="Build a ZIP archive"
          hint="Drag-drop multiple files, reorder them, set a custom archive name, and download a .zip. Uses the STORE method (no compression) — perfect for already-compressed files."
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
                      <p className="font-medium truncate">{h.archiveName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.fileCount} files · {formatBytes(h.totalUncompressed)} → {formatBytes(h.archiveSize)} · {new Date(h.createdAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all ZIP building runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries are saved to local history.
          </p>
          <p className="mt-2 text-[10px] text-muted-foreground">
            <strong>Honesty clause:</strong> uses STORE method (no compression). Password protection and ZIP64 (&gt;4GB) are not currently supported — see the FAQ above.
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
