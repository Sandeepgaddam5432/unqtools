"use client";
import React, { useState, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { ErrorBanner, EmptyState, ShareButton } from "../../_shared";
import { toast } from "sonner";
import {
  parse7z, is7zFile, getMethodName, formatBytes,
  loadHistory, saveToHistory, clearHistory,
  buildShareUrl,
  type HistoryEntry, type SevenZipArchiveInfo,
} from "./logic";
import {
  Upload, FileArchive, History, BarChart3, X, AlertTriangle,
} from "lucide-react";

interface InputFile {
  fileName: string;
  size: number;
  info: SevenZipArchiveInfo;
}

export default function SevenZipExtractor() {
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
        if (!is7zFile(bytes)) {
          setError(`${file.name}: not a valid 7z file (missing '7z\\xbc\\xaf\\'\\x1c' signature)`);
          continue;
        }
        const info = parse7z(bytes);
        newInputs.push({ fileName: file.name, size: file.size, info });
        setHistory(saveToHistory({
          fileName: file.name, fileSize: file.size,
          fileCount: info.fileCount,
          nextHeaderIsCompressed: info.nextHeaderIsCompressed,
          inspectedAt: new Date().toISOString(),
        }));
        toast.success(`Parsed ${file.name} — v${info.header?.majorVersion ?? 0}.${info.header?.minorVersion ?? 0}, NextHeader ${info.nextHeaderIsCompressed ? "compressed" : "uncompressed"}`);
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
            accept=".7z,application/x-7z-compressed"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="7z-input"
            aria-label="Choose .7z files to inspect"
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
            <p className="text-sm font-medium">Drop .7z files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">7z signature detection · SignatureHeader parsing · NextHeader detection · compression method display</p>
          </button>
        </CardContent>
      </Card>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold mb-1">Honesty clause — LZMA compression limitation</p>
              <p>
                Most 7z archives use LZMA or LZMA2 compression. We parse the SignatureHeader and detect whether the NextHeader is compressed, but cannot decompress LZMA-compressed file listings in pure JavaScript. For full extraction, use 7-Zip desktop or 7z-wasm in the browser.
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
                {inp.info.nextHeaderIsCompressed ? (
                  <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30">LZMA compressed</Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">Uncompressed</Badge>
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
            {inp.info.header && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Version" value={`${inp.info.header.majorVersion}.${inp.info.header.minorVersion}`} />
                <Stat label="Files" value={String(inp.info.fileCount)} icon={<BarChart3 className="h-3 w-3" />} />
                <Stat label="Dirs" value={String(inp.info.directoryCount)} />
                <Stat label="Total uncompressed" value={formatBytes(inp.info.totalUncompressedSize)} />
              </div>
            )}
            <div className="rounded-md border p-2 text-[10px] font-mono bg-muted/30">
              <div>NextHeaderOffset: <span className="text-foreground">{inp.info.header?.nextHeaderOffset}</span></div>
              <div>NextHeaderSize: <span className="text-foreground">{inp.info.header?.nextHeaderSize}</span></div>
              <div>NextHeaderCRC: <span className="text-foreground">0x{(inp.info.header?.nextHeaderCrc ?? 0).toString(16).padStart(8, "0")}</span></div>
              <div>StartHeaderCRC: <span className="text-foreground">0x{(inp.info.header?.startHeaderCrc ?? 0).toString(16).padStart(8, "0")}</span></div>
            </div>
            {inp.info.compressionMethods.length > 0 && (
              <div>
                <Label className="text-xs text-muted-foreground">Compression methods:</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {inp.info.compressionMethods.map((m, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">{getMethodName(m)}</Badge>
                  ))}
                </div>
              </div>
            )}
            {inp.info.nextHeaderIsCompressed && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                NextHeader is LZMA-compressed — file listing not available without LZMA decoder.
              </p>
            )}
            {inp.info.entries.length > 0 && (
              <div className="rounded-md border">
                <div className="px-2 py-1 bg-muted/30 text-[10px] text-muted-foreground border-b">
                  File entries ({inp.info.entries.length})
                </div>
                <div className="max-h-[200px] overflow-y-auto">
                  {inp.info.entries.slice(0, 100).map((e, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 px-2 py-1 text-xs border-b border-border/40 last:border-0">
                      <span className="truncate">{e.name}</span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">{formatBytes(e.size)}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {error && <ErrorBanner message={error} />}

      {inputs.length === 0 && !error && (
        <EmptyState
          title="Inspect 7z archives"
          hint="Detects 7z signature, parses 32-byte SignatureHeader, identifies NextHeader compression. Honest about LZMA decompression limitation."
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
                        {h.fileCount} file{h.fileCount === 1 ? "" : "s"} · {formatBytes(h.fileSize)} · NextHeader {h.nextHeaderIsCompressed ? "compressed" : "uncompressed"} · {new Date(h.inspectedAt).toLocaleString()}
                      </p>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => { clearHistory(); setHistory([]); }}
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
            <strong className="text-foreground">Privacy + Honesty:</strong> all 7z signature detection and SignatureHeader parsing runs in your browser using pure JavaScript. File contents never leave your device. This tool parses the 32-byte SignatureHeader and detects whether the NextHeader is LZMA-compressed — it does NOT decompress LZMA-compressed file listings. For full extraction, use 7-Zip desktop or 7z-wasm. Only archive summaries (filename + version) are saved to local history.
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
