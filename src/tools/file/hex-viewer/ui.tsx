"use client";
import React, { useState, useCallback, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  hexDump, hexRows, searchHex, searchAscii, parseOffset, swapEndian,
  computeStats, hexDumpToText, formatBytes,
  loadHistory, saveToHistory, clearHistory, readFileBytes,
  DEFAULT_OPTIONS, type HexOptions, type BytesPerLine, type Endian,
  type FileStats, type HistoryEntry,
} from "./logic";
import { Upload, Binary, History, Search, ArrowRightLeft, Copy } from "lucide-react";

const MAX_LINES_DEFAULT = 256;

export default function HexViewer() {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState<string>("");
  const [options, setOptions] = useState<HexOptions>(DEFAULT_OPTIONS);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchMode, setSearchMode] = useState<"hex" | "ascii">("hex");
  const [jumpOffset, setJumpOffset] = useState<string>("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [maxLines, setMaxLines] = useState<number>(MAX_LINES_DEFAULT);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const update = <K extends keyof HexOptions>(key: K, value: HexOptions[K]) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      const b = await readFileBytes(file);
      setBytes(b);
      setFilename(file.name);
      const stats = computeStats(b);
      const entry: HistoryEntry = {
        filename: file.name,
        size: b.length,
        ext: stats.ext,
        entropy: stats.entropy,
        inspectedAt: new Date().toISOString(),
      };
      setHistory(saveToHistory(entry));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const stats = useMemo<FileStats | null>(() => bytes ? computeStats(bytes) : null, [bytes]);

  const rows = useMemo(() => {
    if (!bytes) return [];
    return hexRows(bytes, options, maxLines);
  }, [bytes, options, maxLines]);

  const matches = useMemo(() => {
    if (!bytes || !searchQuery.trim()) return [];
    return searchMode === "hex" ? searchHex(bytes, searchQuery) : searchAscii(bytes, searchQuery);
  }, [bytes, searchQuery, searchMode]);

  const matchSet = useMemo(() => {
    const set = new Set<number>();
    for (const m of matches) {
      const queryLen = searchMode === "hex"
        ? Math.floor(searchQuery.replace(/\s+/g, "").length / 2)
        : searchQuery.length;
      for (let i = 0; i < queryLen; i++) set.add(m + i);
    }
    return set;
  }, [matches, searchMode, searchQuery]);

  const onJump = useCallback(() => {
    if (!bytes) return;
    const offset = parseOffset(jumpOffset, bytes.length);
    if (offset === null) {
      toast.error("Invalid offset");
      return;
    }
    const lineNum = Math.floor(offset / options.bytesPerLine);
    const targetLine = Math.min(lineNum, maxLines - 1);
    setMaxLines((prev) => Math.max(prev, targetLine + 50));
    toast.success(`Jumped to offset 0x${offset.toString(16)}`);
    // Scroll to row
    setTimeout(() => {
      const el = document.getElementById(`hex-row-${targetLine}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }, [bytes, jumpOffset, options.bytesPerLine, maxLines]);

  const onEndianSwap = useCallback(() => {
    if (!bytes) return;
    const swapped = swapEndian(bytes, 4);
    setBytes(swapped);
    toast.success("Endianness swapped (4-byte words)");
  }, [bytes]);

  const onCopySelection = useCallback(() => {
    if (!selection || !bytes) {
      toast.error("No selection");
      return;
    }
    const slice = bytes.slice(selection.start, selection.end + 1);
    const hex = Array.from(slice).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    navigator.clipboard.writeText(hex)
      .then(() => toast.success(`Copied ${slice.length} bytes as hex`))
      .catch(() => toast.error("Copy failed"));
  }, [selection, bytes]);

  const onSelectByte = useCallback((rowIdx: number, byteIdx: number) => {
    const offset = rowIdx * options.bytesPerLine + byteIdx;
    if (!selection) {
      setSelection({ start: offset, end: offset });
    } else if (offset < selection.start) {
      setSelection({ start: offset, end: selection.start });
    } else if (offset > selection.end) {
      setSelection({ start: selection.start, end: offset });
    } else {
      setSelection({ start: offset, end: offset });
    }
  }, [selection, options.bytesPerLine]);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="hidden"
            id="hex-viewer-input"
            ref={fileInputRef}
            aria-label="Choose file to inspect"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop a file here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Hex dump · ASCII · search · entropy · endian swap · 100% local</p>
          </button>
        </CardContent>
      </Card>

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Reading file...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {stats && bytes && !working && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold inline-flex items-center gap-2">
                  <Binary className="h-4 w-4" /> {filename || "untitled"}
                </Label>
                <div className="flex gap-2 flex-wrap">
                  <CopyButton getText={() => hexDumpToText(bytes, options)} label="Copy dump" size="sm" />
                  <DownloadButton getText={() => hexDumpToText(bytes, options)} filename={`${filename || "hexdump"}.txt`} mime="text/plain" label="Download .txt" size="sm" />
                  <button type="button" onClick={onEndianSwap} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                    <ArrowRightLeft className="h-3 w-3" /> Swap endian
                  </button>
                  <button type="button" onClick={onCopySelection} className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1">
                    <Copy className="h-3 w-3" /> Copy selection
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Size</span>
                  <span className="font-mono">{stats.sizeHuman} ({stats.size.toLocaleString()} B)</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Detected type</span>
                  <span className="font-mono">{stats.ext ? `.${stats.ext}` : "unknown"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Unique bytes</span>
                  <span className="font-mono">{stats.uniqueBytes} / 256</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Entropy</span>
                  <span className="font-mono">{stats.entropy.toFixed(3)} bits/byte</span>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Magic bytes (first 16)</span>
                  <code className="font-mono text-[10px] break-all">{stats.magicBytesHex}</code>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Entropy hint</span>
                  <span className="text-[10px] text-muted-foreground">{stats.entropyHint}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Display options</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Bytes per line</label>
                  <select value={options.bytesPerLine} onChange={(e) => update("bytesPerLine", parseInt(e.target.value) as BytesPerLine)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Bytes per line">
                    <option value={8}>8</option>
                    <option value={16}>16</option>
                    <option value={32}>32</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Endian</label>
                  <select value={options.endian} onChange={(e) => update("endian", e.target.value as Endian)} className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Endian">
                    <option value="big">Big-endian</option>
                    <option value="little">Little-endian</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground">Lines shown</label>
                  <Input type="number" min={1} max={5000} value={maxLines} onChange={(e) => setMaxLines(parseInt(e.target.value) || 256)} className="h-8 text-xs" aria-label="Max lines" />
                </div>
                <div className="space-y-1 flex items-end gap-3">
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={options.upperCase} onChange={(e) => update("upperCase", e.target.checked)} className="cursor-pointer" />
                    <span>UPPER</span>
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="checkbox" checked={options.showAscii} onChange={(e) => update("showAscii", e.target.checked)} className="cursor-pointer" />
                    <span>ASCII</span>
                  </label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold inline-flex items-center gap-1">
                    <Search className="h-3 w-3" /> Search
                  </Label>
                  <div className="flex gap-1">
                    <select value={searchMode} onChange={(e) => setSearchMode(e.target.value as "hex" | "ascii")} className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Search mode">
                      <option value="hex">Hex</option>
                      <option value="ascii">ASCII</option>
                    </select>
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={searchMode === "hex" ? "FFD8FF" : "Hello"} className="h-8 text-xs font-mono" aria-label="Search query" />
                  </div>
                  {searchQuery && (
                    <p className="text-[10px] text-muted-foreground">{matches.length} match{matches.length !== 1 ? "es" : ""}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Jump to offset</Label>
                  <div className="flex gap-1">
                    <Input value={jumpOffset} onChange={(e) => setJumpOffset(e.target.value)} placeholder="0x1000 or 4096" className="h-8 text-xs font-mono" aria-label="Offset to jump to" onKeyDown={(e) => { if (e.key === "Enter") onJump(); }} />
                    <button type="button" onClick={onJump} className="h-8 rounded-md border border-input bg-background px-3 text-xs cursor-pointer hover:bg-accent">Go</button>
                  </div>
                </div>
              </div>
              {matches.length > 0 && (
                <div className="text-[10px] text-muted-foreground max-h-[80px] overflow-y-auto">
                  {matches.slice(0, 50).map((m, i) => (
                    <button key={i} type="button" onClick={() => { setJumpOffset(`0x${m.toString(16)}`); onJump(); }} className="block hover:text-foreground cursor-pointer">
                      · offset 0x{m.toString(16).padStart(8, "0")} ({m.toLocaleString()})
                    </button>
                  ))}
                  {matches.length > 50 && <span className="text-muted-foreground">+ {matches.length - 50} more</span>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Hex dump</Label>
                {selection && (
                  <Badge variant="outline" className="text-[10px]">
                    Selection: 0x{selection.start.toString(16)} — 0x{selection.end.toString(16)} ({selection.end - selection.start + 1} B)
                  </Badge>
                )}
              </div>
              <div className="overflow-auto max-h-[480px] rounded-md border bg-muted/30">
                <pre className="font-mono text-[10px] leading-relaxed whitespace-pre p-2">
                  {rows.map((row, idx) => (
                    <div key={idx} id={`hex-row-${idx}`} className="hover:bg-primary/5 px-1 rounded">
                      <span className="text-muted-foreground">{row.offsetHex}</span>{"  "}
                      {row.hex.map((h, i) => {
                        const globalOffset = row.offset + i;
                        const isSelected = selection && globalOffset >= selection.start && globalOffset <= selection.end;
                        const isMatch = matchSet.has(globalOffset);
                        return (
                          <span
                            key={i}
                            onClick={() => onSelectByte(idx, i)}
                            className={`cursor-pointer px-[1px] rounded ${isSelected ? "bg-primary/30" : isMatch ? "bg-amber-500/30 text-amber-900 dark:text-amber-200" : ""}`}
                          >
                            {h}{" "}
                          </span>
                        );
                      })}
                      {options.showAscii && (
                        <span className="text-muted-foreground">{"  |"}{row.ascii.map((a, i) => {
                          const globalOffset = row.offset + i;
                          const isMatch = matchSet.has(globalOffset);
                          return <span key={i} className={isMatch ? "bg-amber-500/30" : ""}>{a}</span>;
                        })}{"|"}</span>
                      )}
                    </div>
                  ))}
                </pre>
              </div>
              {bytes.length > maxLines * options.bytesPerLine && (
                <p className="text-[10px] text-muted-foreground">
                  Showing {maxLines} of {Math.ceil(bytes.length / options.bytesPerLine)} lines. Increase "Lines shown" to see more.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold inline-flex items-center gap-1"><History className="h-3 w-3" /> History ({history.length})</Label>
                {history.length > 0 && (
                  <button type="button" onClick={() => { clearHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
                )}
              </div>
              <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                {showHistory ? "Hide" : "Show"} history
              </button>
              {showHistory && (
                history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[160px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="text-xs py-1 border-b border-border/40 last:border-0">
                        <p className="font-medium truncate">{h.filename}</p>
                        <p className="text-[10px] text-muted-foreground">{formatBytes(h.size)} · .{h.ext ?? "?"} · entropy {h.entropy.toFixed(2)} · {new Date(h.inspectedAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </>
      )}

      {!bytes && !error && !working && (
        <EmptyState title="Drop a file to inspect" hint="Hex dump · ASCII sidebar · search · entropy · endian swap · magic bytes. 100% local." icon={<Binary className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all byte reading runs in your browser. Files never leave your device. Only filenames + sizes are saved to history.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
