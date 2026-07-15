"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  createManifest, parseManifest, manifestToJson, manifestToCsv,
  verifyManifests, computeManifestStats, formatBytes, diffToPlainText,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type Manifest, type HashAlgorithm, type VerifyDiff, type AuditHistoryEntry,
} from "./logic";
import {
  Upload, FileCheck, FolderOpen, History, ShieldCheck, ArrowRight,
  Plus, Minus, Pencil, Check, BarChart3,
} from "lucide-react";

export default function LocalFileIntegrityAuditor() {
  const [algorithm, setAlgorithm] = useState<HashAlgorithm>("SHA-256");
  const [excludePatterns, setExcludePatterns] = useState("");
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [baseline, setBaseline] = useState<Manifest | null>(null);
  const [diff, setDiff] = useState<VerifyDiff | null>(null);
  const [diffStats, setDiffStats] = useState<{ added: number; modified: number; deleted: number; unchanged: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "added" | "modified" | "deleted" | "unchanged">("all");
  const [working, setWorking] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AuditHistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const baselineInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => manifest ? computeManifestStats(manifest.files) : null, [manifest]);

  const handleFiles = useCallback(async (files: FileList | null, mode: "create" | "verify") => {
    if (!files || files.length === 0) return;
    setWorking(true);
    setError(null);
    setProgress({ current: 0, total: files.length });
    try {
      const newManifest = await createManifest(
        Array.from(files),
        algorithm,
        excludePatterns,
        "",
        "",
        (current, total) => setProgress({ current, total }),
      );
      setManifest(newManifest);
      setProgress(null);
      if (mode === "create") {
        setBaseline(newManifest);
        setDiff(null);
        setDiffStats(null);
        const entry: AuditHistoryEntry = {
          basePath: newManifest.basePath || "(files)",
          algorithm,
          fileCount: newManifest.files.length,
          totalSize: stats?.totalSize ?? newManifest.files.reduce((s, f) => s + f.size, 0),
          added: 0, modified: 0, deleted: 0,
          auditedAt: new Date().toISOString(),
        };
        setHistory(saveToHistory(entry));
        toast.success(`Manifest created — ${newManifest.files.length} files`);
      } else if (baseline) {
        const { diff, stats: verifyStats } = verifyManifests(baseline, newManifest);
        setDiff(diff);
        setDiffStats({ added: verifyStats.added, modified: verifyStats.modified, deleted: verifyStats.deleted, unchanged: verifyStats.unchanged });
        const entry: AuditHistoryEntry = {
          basePath: baseline.basePath || "(files)",
          algorithm,
          fileCount: newManifest.files.length,
          totalSize: newManifest.files.reduce((s, f) => s + f.size, 0),
          added: verifyStats.added, modified: verifyStats.modified, deleted: verifyStats.deleted,
          auditedAt: new Date().toISOString(),
        };
        setHistory(saveToHistory(entry));
        toast.success(`Verified — ${verifyStats.added + verifyStats.modified + verifyStats.deleted} changes`);
      } else {
        toast.info("Pick a baseline manifest first to verify");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
      setProgress(null);
    }
  }, [algorithm, excludePatterns, baseline, stats]);

  const handleImportBaseline = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const text = await files[0].text();
      const parsed = parseManifest(text);
      setBaseline(parsed);
      toast.success(`Baseline loaded — ${parsed.files.length} files from ${new Date(parsed.createdAt).toLocaleString()}`);
    } catch (e) {
      setError(`Failed to parse manifest: ${(e as Error).message}`);
    }
  }, []);

  const filteredDiff = useMemo(() => {
    if (!diff) return null;
    if (filter === "all") return diff;
    if (filter === "added") return { ...diff, modified: [], deleted: [], unchanged: [] };
    if (filter === "modified") return { ...diff, added: [], deleted: [], unchanged: [] };
    if (filter === "deleted") return { ...diff, added: [], modified: [], unchanged: [] };
    return { ...diff, added: [], modified: [], deleted: [] };
  }, [diff, filter]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Audit options</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Hash algorithm</Label>
              <select
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as HashAlgorithm)}
                className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
                aria-label="Hash algorithm"
              >
                <option value="SHA-256">SHA-256 (recommended)</option>
                <option value="SHA-512">SHA-512</option>
                <option value="SHA-1">SHA-1 (legacy)</option>
                <option value="MD5">MD5 (legacy)</option>
              </select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Exclude patterns (comma-separated globs)</Label>
              <Input
                placeholder="*.log, .git/*, node_modules/*"
                value={excludePatterns}
                onChange={(e) => setExcludePatterns(e.target.value)}
                aria-label="Exclude patterns"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ShareButton getUrl={() => buildShareUrl(algorithm, excludePatterns)} label="Share options" size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold">Step 1 — Create or import a baseline manifest</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input ref={directoryInputRef} type="file" multiple directory="" webkitdirectory="" onChange={(e) => handleFiles(e.target.files, "create")} className="hidden" aria-label="Pick folder" />
            <input ref={fileInputRef} type="file" multiple onChange={(e) => handleFiles(e.target.files, "create")} className="hidden" aria-label="Pick files" />
            <button
              type="button"
              onClick={() => directoryInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files, "create"); }}
              className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <FolderOpen className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium">Pick folder or drop files</p>
              <p className="text-[10px] text-muted-foreground mt-1">Creates a baseline manifest</p>
            </button>
            <input ref={baselineInputRef} type="file" accept=".json,application/json" onChange={(e) => handleImportBaseline(e.target.files)} className="hidden" aria-label="Import baseline JSON" />
            <button
              type="button"
              onClick={() => baselineInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium">Import baseline JSON</p>
              <p className="text-[10px] text-muted-foreground mt-1">Load an existing manifest</p>
            </button>
          </div>
          {baseline && (
            <div className="rounded-md border bg-muted/30 p-2 text-xs">
              <p className="font-medium">Baseline loaded</p>
              <p className="text-[10px] text-muted-foreground">
                {baseline.files.length} files · {baseline.algorithm} · created {new Date(baseline.createdAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {baseline && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Step 2 — Verify current folder against baseline</Label>
            <input ref={directoryInputRef} type="file" multiple directory="" webkitdirectory="" onChange={(e) => handleFiles(e.target.files, "verify")} className="hidden" aria-hidden />
            <button
              type="button"
              onClick={() => directoryInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files, "verify"); }}
              className="w-full rounded-xl border-2 border-dashed border-border p-6 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-xs font-medium">Pick current folder or drop files</p>
              <p className="text-[10px] text-muted-foreground mt-1">Verifies against baseline</p>
            </button>
          </CardContent>
        </Card>
      )}

      {working && progress && (
        <Card><CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Hashing files...</span>
            <span>{progress.current} / {progress.total}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress.total === 0 ? 0 : (progress.current / progress.total) * 100}%` }} />
          </div>
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {manifest && stats && !working && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Manifest</Label>
              <div className="flex gap-2 flex-wrap">
                <DownloadButton getText={() => manifestToJson(manifest)} filename="manifest.json" label="JSON" size="sm" />
                <DownloadButton getText={() => manifestToCsv(manifest)} filename="manifest.csv" label="CSV" size="sm" mime="text/csv" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Files" value={String(stats.fileCount)} icon={<FileCheck className="h-3 w-3" />} />
              <Stat label="Total size" value={formatBytes(stats.totalSize)} icon={<BarChart3 className="h-3 w-3" />} />
              <Stat label="Avg size" value={formatBytes(stats.avgSize)} />
              <Stat label="Algorithm" value={manifest.algorithm} />
            </div>
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">By extension</summary>
              <div className="flex flex-wrap gap-1 mt-2">
                {Object.entries(stats.byExtension).sort((a, b) => b[1] - a[1]).map(([ext, count]) => (
                  <Badge key={ext} variant="outline" className="text-[10px]">.{ext}: {count}</Badge>
                ))}
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {diff && diffStats && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <Label className="text-sm font-semibold">Verification diff</Label>
              <div className="flex gap-1">
                <CopyButton getText={() => diffToPlainText(diff)} label="Copy changes" size="sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Stat label="Added" value={String(diffStats.added)} accent="green" icon={<Plus className="h-3 w-3" />} />
              <Stat label="Modified" value={String(diffStats.modified)} accent="amber" icon={<Pencil className="h-3 w-3" />} />
              <Stat label="Deleted" value={String(diffStats.deleted)} accent="red" icon={<Minus className="h-3 w-3" />} />
              <Stat label="Unchanged" value={String(diffStats.unchanged)} icon={<Check className="h-3 w-3" />} />
            </div>
            <div className="flex flex-wrap gap-1">
              {(["all", "added", "modified", "deleted", "unchanged"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-2 py-1 rounded-md text-[10px] border cursor-pointer ${filter === f ? "bg-primary text-primary-foreground border-primary" : "bg-background border-input hover:bg-accent"}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {filteredDiff && (
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                {filteredDiff.added.length === 0 && filteredDiff.modified.length === 0 && filteredDiff.deleted.length === 0 && filteredDiff.unchanged.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground text-center">No entries for this filter.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr>
                        <th className="px-2 py-1 text-left text-[10px]">Status</th>
                        <th className="px-2 py-1 text-left text-[10px]">Path</th>
                        <th className="px-2 py-1 text-right text-[10px]">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDiff.added.map((e, i) => (
                        <DiffRow key={`a-${i}`} status="added" path={e.path} size={e.size} />
                      ))}
                      {filteredDiff.modified.map((m, i) => (
                        <DiffRow key={`m-${i}`} status="modified" path={m.entry.path} size={m.entry.size} extra={`${formatBytes(m.oldSize)} → ${formatBytes(m.entry.size)}`} />
                      ))}
                      {filteredDiff.deleted.map((e, i) => (
                        <DiffRow key={`d-${i}`} status="deleted" path={e.path} size={e.size} />
                      ))}
                      {filteredDiff.unchanged.map((e, i) => (
                        <DiffRow key={`u-${i}`} status="unchanged" path={e.path} size={e.size} />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!manifest && !error && !working && (
        <EmptyState
          title="Audit folder integrity"
          hint="Create a SHA-256 manifest of a folder, then re-verify later to detect added / modified / deleted files. 100% local."
          icon={<FileCheck className="h-8 w-8" />}
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
                <Label className="text-xs font-semibold">Recent audits</Label>
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
                      <p className="font-medium truncate">{h.basePath}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {h.algorithm} · {h.fileCount} files · {formatBytes(h.totalSize)} · +{h.added} ~{h.modified} -{h.deleted} · {new Date(h.auditedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all hashing runs in your browser via WebCrypto. File contents never leave your device. Only manifest metadata is saved if you export it.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: "green" | "amber" | "red" }) {
  const colorClass = accent === "green" ? "text-emerald-600 dark:text-emerald-400"
    : accent === "amber" ? "text-amber-600 dark:text-amber-400"
    : accent === "red" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">{icon}{label}</p>
      <p className={`text-sm font-mono font-semibold ${colorClass}`}>{value}</p>
    </div>
  );
}

function DiffRow({ status, path, size, extra }: { status: "added" | "modified" | "deleted" | "unchanged"; path: string; size: number; extra?: string }) {
  const rowClass = status === "added" ? "bg-emerald-500/5"
    : status === "modified" ? "bg-amber-500/5"
    : status === "deleted" ? "bg-red-500/5" : "";
  const badgeClass = status === "added" ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
    : status === "modified" ? "border-amber-500/30 text-amber-700 dark:text-amber-400"
    : status === "deleted" ? "border-red-500/30 text-red-700 dark:text-red-400"
    : "border-border text-muted-foreground";
  return (
    <tr className={`border-t border-border/40 ${rowClass}`}>
      <td className="px-2 py-1">
        <Badge variant="outline" className={`text-[9px] uppercase ${badgeClass}`}>{status}</Badge>
      </td>
      <td className="px-2 py-1 font-mono text-[10px] break-all">{path}</td>
      <td className="px-2 py-1 text-right text-[10px] text-muted-foreground">
        {extra ?? formatBytes(size)}
      </td>
    </tr>
  );
}
