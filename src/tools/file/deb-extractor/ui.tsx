"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  isArArchive, parseDeb, extractArMember, detectCompression,
  computeStats, searchMembers, previewMember, detectMimeFromName,
  formatBytes, formatMode, formatMtime,
  buildZipFromDeb, inflateGzip, parseTarEntries, findControlFile, parseControl,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type DebInfo, type DebStats, type ControlInfo, type ArMember, type HistoryEntry,
} from "./logic";
import {
  Upload, FileArchive, Download, History, BarChart3, X, Eye,
  Search, Package,
} from "lucide-react";

interface ArchiveData {
  fileName: string;
  size: number;
  bytes: Uint8Array;
  info: DebInfo;
  stats: DebStats;
  control: ControlInfo | null;
}

export default function DebExtractor() {
  const [archive, setArchive] = useState<ArchiveData | null>(null);
  const [search, setSearch] = useState("");
  const [previewMember, setPreviewMember] = useState<ArMember | null>(null);
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
      if (!isArArchive(bytes)) {
        setError(`${file.name}: not an AR/DEB archive (missing "!<arch>\\n" magic).`);
        setArchive(null);
        return;
      }
      const info = parseDeb(bytes);
      if (info.members.length === 0) {
        setError(`${file.name}: AR archive has no members.`);
        setArchive(null);
        return;
      }
      const stats = computeStats(info);
      let control: ControlInfo | null = null;
      if (info.controlArchive && info.controlCompression === "gzip") {
        try {
          const memberBytes = extractArMember(bytes, info.controlArchive);
          const inflated = await inflateGzip(memberBytes);
          const tarEntries = parseTarEntries(inflated);
          const controlEntry = findControlFile(tarEntries);
          if (controlEntry) {
            const controlBytes = inflated.subarray(controlEntry.dataOffset, controlEntry.dataOffset + controlEntry.size);
            const controlText = new TextDecoder("utf-8").decode(controlBytes);
            control = parseControl(controlText);
          }
        } catch {
          // Skip control parsing on error.
        }
      }
      setArchive({ fileName: file.name, size: bytes.length, bytes, info, stats, control });
      setHistory(saveToHistory({
        fileName: file.name,
        archiveSize: bytes.length,
        memberCount: stats.memberCount,
        packageName: control?.package ?? "",
        packageVersion: control?.version ?? "",
        architecture: control?.architecture ?? "",
        extractedAt: new Date().toISOString(),
      }));
      toast.success(`Parsed ${stats.memberCount} AR members from ${file.name}`);
    } catch (e) {
      setError(`${file.name}: ${(e as Error).message}`);
      setArchive(null);
    } finally {
      setWorking(false);
    }
  }, []);

  const filteredMembers = useMemo(() => {
    if (!archive) return [];
    return searchMembers(archive.info.members, search).filter((m) => !m.isLongNameTable);
  }, [archive, search]);

  const downloadMember = useCallback((member: ArMember) => {
    if (!archive) return;
    const data = extractArMember(archive.bytes, member);
    const mime = detectMimeFromName(member.name);
    const blob = new Blob([data as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = member.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${member.name}`);
  }, [archive]);

  const downloadAllZip = useCallback(() => {
    if (!archive) return;
    const blob = buildZipFromDeb(archive.bytes, archive.info);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${archive.fileName.replace(/\.deb$/i, "")}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${archive.fileName.replace(/\.deb$/i, "")}.zip`);
  }, [archive]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            accept=".deb,.ar,application/vnd.debian.binary-package,application/x-archive"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="deb-input"
            aria-label="Choose a .deb file"
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
            <p className="text-sm font-medium">Drop a .deb file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Pure-JS AR parser · package info · preview · ZIP download</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Parsing .deb AR archive…
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
                    onClick={() => { setArchive(null); setSearch(""); }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer px-2"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                <Stat label="Members" value={String(archive.stats.memberCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Format" value={archive.info.debFormatVersion || "—"} />
                <Stat label="Ctrl comp" value={archive.info.controlCompression} />
                <Stat label="Data comp" value={archive.info.dataCompression} />
                <Stat label="Total size" value={formatBytes(archive.stats.totalSize)} accent />
                <Stat label="Archive" value={formatBytes(archive.size)} />
              </div>
              {archive.stats.hasXz && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  ⚠ This .deb uses XZ compression. Members can still be downloaded; the package-info panel is unavailable for XZ.
                </p>
              )}
            </CardContent>
          </Card>

          {archive.control && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Package className="h-3.5 w-3.5" /> Package info
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <Field label="Package" value={archive.control.package} />
                  <Field label="Version" value={archive.control.version} />
                  <Field label="Architecture" value={archive.control.architecture} />
                  <Field label="Maintainer" value={archive.control.maintainer} />
                  <Field label="Section" value={archive.control.section} />
                  <Field label="Priority" value={archive.control.priority} />
                  <Field label="Installed-Size" value={archive.control.installedSize} />
                  <Field label="Homepage" value={archive.control.homepage} />
                </div>
                {archive.control.description && (
                  <div className="text-xs">
                    <p className="text-[10px] text-muted-foreground">Description</p>
                    <p className="whitespace-pre-line">{archive.control.description}</p>
                  </div>
                )}
                {archive.control.depends && (
                  <div className="text-xs">
                    <p className="text-[10px] text-muted-foreground">Depends</p>
                    <p className="font-mono break-all">{archive.control.depends}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Members</Label>
                <ShareButton getUrl={() => buildShareUrl({ search })} label="Share view" size="sm" />
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search members by name…"
                  className="pl-7"
                  aria-label="Search members"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{filteredMembers.length} member{filteredMembers.length === 1 ? "" : "s"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="max-h-[400px] overflow-y-auto rounded-md border">
                {filteredMembers.length === 0 ? (
                  <p className="p-3 text-xs text-muted-foreground">No matching members.</p>
                ) : (
                  filteredMembers.map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      className="grid grid-cols-[1fr_auto_auto] gap-2 items-center text-xs px-3 py-2 border-b border-border/40 last:border-0 hover:bg-accent/30"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{m.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          mtime {formatMtime(m.mtime)} · uid {m.uid} · gid {m.gid} · mode {formatMode(m.mode)}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px] font-mono">{formatBytes(m.size)}</Badge>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewMember(m)}
                          className="p-1 rounded hover:bg-accent cursor-pointer"
                          aria-label={`Preview ${m.name}`}
                          title="Preview"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadMember(m)}
                          className="p-1 rounded hover:bg-accent cursor-pointer"
                          aria-label={`Download ${m.name}`}
                          title="Download"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {previewMember && archive && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Preview: {previewMember.name}</Label>
              <button
                type="button"
                onClick={() => setPreviewMember(null)}
                className="p-1 rounded-md hover:bg-accent cursor-pointer"
                aria-label="Close preview"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {(() => {
              const preview = previewMember(archive.bytes, previewMember);
              return (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    <Badge variant="outline">{formatBytes(preview.size)}</Badge>
                    <Badge variant="outline">{detectMimeFromName(previewMember.name)}</Badge>
                    {preview.truncated && <Badge variant="outline">truncated to 8 KB</Badge>}
                  </div>
                  {preview.isText ? (
                    <pre className="text-[10px] font-mono bg-muted/30 rounded p-2 max-h-[300px] overflow-auto whitespace-pre-wrap break-all">
                      {preview.text}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">Binary member — preview not available.</p>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {error && <ErrorBanner message={error} />}

      {!archive && !error && !working && (
        <EmptyState
          title="Extract .deb packages"
          hint="Pure-JS AR parser — no WASM. Lists debian-binary, control.tar.gz, and data.tar.gz; parses control for package info. Use GZIP Decompressor + TAR Extractor for the data payload."
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
                <Label className="text-xs font-semibold">Recent .deb files</Label>
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
                        {h.memberCount} members · {formatBytes(h.archiveSize)}
                        {h.packageName ? ` · ${h.packageName} ${h.packageVersion} (${h.architecture})` : ""}
                        {" · "}
                        {new Date(h.extractedAt).toLocaleString()}
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
            <strong className="text-foreground">Privacy:</strong> all AR parsing runs in your browser using pure JavaScript. File contents never leave your device. Only archive summaries are saved to local history.
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
      <p className="font-mono break-all">{value || "—"}</p>
    </div>
  );
}
