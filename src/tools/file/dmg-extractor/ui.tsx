"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseDmg, isDmgFile, getCompressionName, formatBytes,
  loadHistory, saveToHistory, clearHistory, buildShareUrl,
  type HistoryEntry, type DmgArchiveInfo,
} from "./logic";
import {
  Upload, FileArchive, History, BarChart3, X, AlertTriangle, ExternalLink,
} from "lucide-react";
import Link from "next/link";

interface InputFile {
  fileName: string;
  size: number;
  info: DmgArchiveInfo;
}

export default function DmgExtractor() {
  const [inputs, setInputs] = useState<InputFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setError(null);
    const newInputs: InputFile[] = [];
    for (const file of Array.from(fileList)) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!isDmgFile(bytes)) {
          setError(`${file.name}: not a valid DMG file (missing 'koly' UDIF trailer at file end).`);
          continue;
        }
        const info = parseDmg(bytes);
        newInputs.push({ fileName: file.name, size: file.size, info });
        setHistory(
          saveToHistory({
            fileName: file.name,
            fileSize: file.size,
            version: info.trailer?.version ?? 0,
            compressionScheme: info.compressionScheme,
            segmentCount: info.trailer?.segmentCount ?? 1,
            inspectedAt: new Date().toISOString(),
          }),
        );
        toast.success(
          `Parsed ${file.name} — v${info.trailer?.version ?? 0}, ${info.compressionName}`,
        );
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
    }
    setInputs((prev) => [...prev, ...newInputs]);
  }, []);

  const removeInput = useCallback((index: number) => {
    setInputs((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            accept=".dmg,application/x-apple-diskimage,application/octet-stream"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="dmg-input"
            aria-label="Choose .dmg files to inspect"
            ref={fileInputRef}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFiles(e.dataTransfer.files);
            }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop .dmg files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">
              UDIF koly trailer detection · 512-byte trailer parsing · compression scheme · partition hints
            </p>
          </button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — HFS+/APFS extraction limitation</p>
              <p>
                We parse the 512-byte UDIF &lsquo;koly&rsquo; trailer at the file end and detect the
                compression scheme (UDZO/UDBZ/ULFO/UFBI/UDRO), but we cannot decode the HFS+ or APFS
                filesystem inside the DMG data fork in pure JavaScript. For full extraction, mount the
                DMG natively on macOS (double-click), or use 7-Zip on Windows. To extract individual
                files inside, see our{" "}
                <Link href="/tools/online-zip-extractor" className="underline inline-flex items-center gap-0.5">
                  Online ZIP Extractor <ExternalLink className="h-3 w-3" />
                </Link>{" "}
                after re-zipping the contents.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {inputs.map((inp, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <FileArchive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <p className="text-sm font-medium truncate">{inp.fileName}</p>
                <Badge variant="outline" className="text-[10px]">{formatBytes(inp.size)}</Badge>
                {inp.info.isEncrypted ? (
                  <Badge variant="outline" className="text-[10px] text-red-600 border-red-500/30">
                    Encrypted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                    Not encrypted
                  </Badge>
                )}
                {inp.info.isMultiSegment && (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">
                    Multi-segment
                  </Badge>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeInput(idx)}
                className="p-1 rounded-md hover:bg-accent cursor-pointer"
                aria-label={`Remove ${inp.fileName}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {inp.info.trailer && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat
                  label="Version"
                  value={`${inp.info.trailer.version}`}
                />
                <Stat
                  label="Compression"
                  value={inp.info.compressionName}
                  icon={<BarChart3 className="h-3 w-3" />}
                />
                <Stat
                  label="Segments"
                  value={`${inp.info.trailer.segmentNumber}/${inp.info.trailer.segmentCount}`}
                />
                <Stat
                  label="Data fork"
                  value={formatBytes(inp.info.trailer.dataForkLength)}
                />
              </div>
            )}
            {inp.info.trailer && (
              <div className="rounded-md border p-2 text-[10px] font-mono bg-muted/30 break-all">
                <div>Signature: <span className="text-foreground">{inp.info.trailer.signature || "(none)"}</span></div>
                <div>Header size: <span className="text-foreground">{inp.info.trailer.headerSize} bytes</span></div>
                <div>Flags: <span className="text-foreground">0x{inp.info.trailer.flags.toString(16).padStart(8, "0")}</span></div>
                <div>UUID: <span className="text-foreground">{inp.info.trailer.uuid || "(none)"}</span></div>
                <div>Data fork offset: <span className="text-foreground">{inp.info.trailer.dataForkOffset}</span></div>
                <div>Resource fork offset: <span className="text-foreground">{inp.info.trailer.resourceForkOffset}</span></div>
                <div>Resource fork length: <span className="text-foreground">{formatBytes(inp.info.trailer.resourceForkLength)}</span></div>
                <div>Plist offset: <span className="text-foreground">{inp.info.trailer.plistOffset}</span> ({inp.info.trailer.plistLength} bytes)</div>
                <div>Checksum type: <span className="text-foreground">{inp.info.trailer.checksumType} ({inp.info.trailer.checksumBits} bits)</span></div>
              </div>
            )}
            {inp.info.compressionScheme && (
              <div>
                <Label className="text-xs text-muted-foreground">
                  Detected compression: {getCompressionName(inp.info.compressionScheme)}
                </Label>
              </div>
            )}
            {inp.info.partitions.length > 0 && (
              <div className="rounded-md border">
                <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">
                  Partition entries ({inp.info.partitions.length})
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {inp.info.partitions.slice(0, 50).map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0"
                    >
                      <span className="truncate">{p.name}</span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {p.type}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {inp.info.isEncrypted && (
              <p className="text-[10px] text-red-600 dark:text-red-400">
                DMG is encrypted — file contents cannot be inspected or extracted.
              </p>
            )}
          </CardContent>
        </Card>
      ))}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && (
        <EmptyState
          title="Inspect macOS DMG disk images"
          hint="Detects the UDIF 'koly' trailer at the file end (last 512 bytes), parses trailer fields, detects compression scheme (UDZO/UDBZ/ULFO/UFBI/UDRO), and lists partition hints. Honest about HFS+/APFS extraction limitations."
          icon={<FileArchive className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer inline-flex items-center gap-1"
            >
              <History className="h-3 w-3" /> History ({history.length})
            </button>
            <ShareButton getUrl={() => buildShareUrl()} label="Share" size="sm" />
          </div>
          {showHistory && (
            <>
              {history.length === 0 ? (
                <p className="text-xs text-muted-foreground">No history yet.</p>
              ) : (
                <div className="space-y-1 max-h-[200px] overflow-y-auto">
                  {history.map((h, i) => (
                    <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                      <p className="font-medium truncate">{h.fileName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        v{h.version} · {h.compressionScheme ?? "Unknown compression"} · {h.segmentCount} segment(s) ·{" "}
                        {formatBytes(h.fileSize)} · {new Date(h.inspectedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      clearHistory();
                      setHistory([]);
                    }}
                    className="text-[10px] text-red-600 hover:underline cursor-pointer mt-1"
                  >
                    Clear history
                  </button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy + Honesty:</strong> all DMG koly trailer
            detection and field parsing runs in your browser using pure JavaScript. Only the last
            512 bytes (the trailer) are parsed. File contents never leave your device. This tool
            does NOT decode the HFS+ or APFS filesystem inside the DMG data fork — full extraction
            requires native macOS tools or 7-Zip. Only archive summaries (filename, version,
            compression scheme, segment count) are saved to local history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={`text-sm font-mono font-semibold ${accent ? "text-emerald-600 dark:text-emerald-400" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}
