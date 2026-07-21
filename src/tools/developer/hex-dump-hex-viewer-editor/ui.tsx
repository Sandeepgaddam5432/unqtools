"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  History, Binary, Search, ChevronLeft, ChevronRight,
  Undo2, Redo2, FileUp, ShieldCheck, FileText, Tag,
} from "lucide-react";
import {
  SUPPORTED_BYTES_PER_LINE,
  SUPPORTED_GROUP_SIZES,
  INSPECTOR_TYPES,
  hexStringToBytes,
  bytesToHexString,
  byteToHex,
  byteToAscii,
  parseOffset,
  renderHexDump,
  renderHexDumpText,
  setByte,
  insertBytes,
  deleteBytes,
  search as searchFn,
  findNextMatch,
  findPrevMatch,
  formatByte,
  inspectBoth,
  allChecksums,
  detectFileType,
  formatByteSize,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  readFileToBytes,
  makeDownloadBlob,
  initUndo,
  pushUndo,
  undo as undoFn,
  redo as redoFn,
  type DisplayFormat,
  type SearchMode,
  type InspectorType,
  type HexDumpLine,
  type HistoryEntry,
  type UndoState,
} from "./logic";

const INSPECTOR_LABELS: Record<InspectorType, string> = {
  int8: "int8",
  uint8: "uint8",
  int16: "int16",
  uint16: "uint16",
  int32: "int32",
  uint32: "uint32",
  int64: "int64",
  uint64: "uint64",
  float32: "float32",
  float64: "float64",
  uleb128: "ULEB128",
  sleb128: "SLEB128",
  ascii: "ASCII",
  utf8: "UTF-8",
  utf16be: "UTF-16 BE",
  utf16le: "UTF-16 LE",
};

export default function HexDumpViewerEditor() {
  const [inputText, setInputText] = useState("FF D8 FF E0 00 10 4A 46 49 46 00 01 01 00 00 01 00 01 00 00");
  const [bytes, setBytes] = useState<Uint8Array>(() => hexStringToBytes("FF D8 FF E0 00 10 4A 46 49 46 00 01 01 00 00 01 00 01 00 00"));
  const [undoState, setUndoState] = useState<UndoState>(() => initUndo(bytes));
  const [bytesPerLine, setBytesPerLine] = useState<number>(16);
  const [groupSize, setGroupSize] = useState<number>(1);
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("hex");
  const [offsetBase, setOffsetBase] = useState<"hex" | "dec">("hex");
  const [cursor, setCursor] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("hex");
  const [gotoText, setGotoText] = useState("");
  const [fileName, setFileName] = useState("pasted.bin");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bytes.length > 0) {
        setBytes(p.bytes);
        setUndoState(initUndo(p.bytes));
        setInputText(bytesToHexString(p.bytes, true, " "));
        toast.info("Loaded from share link");
      } else if (p.truncated) {
        toast.info(`Share link truncated — original was ${formatByteSize(p.originalSize)}`);
      }
    }
  }, []);

  // Parse input text → bytes
  const parseInput = useCallback((text: string): Uint8Array => {
    try {
      // Try hex first; if it fails, fall back to ASCII
      try {
        return hexStringToBytes(text);
      } catch {
        return new TextEncoder().encode(text);
      }
    } catch {
      return new Uint8Array(0);
    }
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    const newBytes = parseInput(text);
    setBytes(newBytes);
    setUndoState(initUndo(newBytes));
    if (cursor >= newBytes.length) setCursor(0);
  }, [parseInput, cursor]);

  const lines = useMemo<HexDumpLine[]>(
    () => renderHexDump(bytes, { bytesPerLine, groupSize, offsetBase }),
    [bytes, bytesPerLine, groupSize, offsetBase],
  );

  const dumpText = useMemo(
    () => renderHexDumpText(bytes, { bytesPerLine, groupSize, offsetBase }),
    [bytes, bytesPerLine, groupSize, offsetBase],
  );

  const searchResult = useMemo(
    () => searchQuery ? searchFn(bytes, searchQuery, searchMode) : { matches: [] },
    [bytes, searchQuery, searchMode],
  );

  const checksums = useMemo(() => allChecksums(bytes), [bytes]);
  const fileType = useMemo(() => detectFileType(bytes), [bytes]);

  const inspectorRows = useMemo(() => {
    return INSPECTOR_TYPES.map((t) => {
      const both = inspectBoth(bytes, cursor, t);
      return { type: t, values: both };
    });
  }, [bytes, cursor]);

  const cursorByte = cursor < bytes.length ? bytes[cursor] : 0;

  const applyEdit = useCallback((next: Uint8Array) => {
    setUndoState((prev) => pushUndo(prev, next));
    setBytes(next);
    setInputText(bytesToHexString(next, true, " "));
  }, []);

  const handleSetByte = useCallback((offset: number, value: number) => {
    if (offset < 0 || offset >= bytes.length) return;
    const next = setByte(bytes, offset, value);
    applyEdit(next);
  }, [bytes, applyEdit]);

  const handleInsert = useCallback((offset: number, value: number) => {
    const next = insertBytes(bytes, offset, [value]);
    applyEdit(next);
  }, [bytes, applyEdit]);

  const handleDelete = useCallback((offset: number) => {
    if (bytes.length === 0) return;
    const next = deleteBytes(bytes, offset, 1);
    applyEdit(next);
    if (cursor >= next.length) setCursor(Math.max(0, next.length - 1));
  }, [bytes, applyEdit, cursor]);

  const handleUndo = useCallback(() => {
    setUndoState((prev) => {
      const next = undoFn(prev);
      setBytes(next.present);
      setInputText(bytesToHexString(next.present, true, " "));
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setUndoState((prev) => {
      const next = redoFn(prev);
      setBytes(next.present);
      setInputText(bytesToHexString(next.present, true, " "));
      return next;
    });
  }, []);

  const handleGoto = useCallback(() => {
    const offset = parseOffset(gotoText);
    if (offset < 0 || offset >= bytes.length) {
      toast.error("Invalid offset");
      return;
    }
    setCursor(offset);
    toast.success(`Jumped to offset 0x${offset.toString(16).toUpperCase()}`);
  }, [gotoText, bytes.length]);

  const handleSearchNext = useCallback(() => {
    const idx = findNextMatch(searchResult.matches, cursor);
    if (idx === -1) {
      toast.info("No more matches");
      return;
    }
    setCursor(searchResult.matches[idx].offset);
  }, [searchResult.matches, cursor]);

  const handleSearchPrev = useCallback(() => {
    const idx = findPrevMatch(searchResult.matches, cursor);
    if (idx === -1) {
      toast.info("No previous match");
      return;
    }
    setCursor(searchResult.matches[idx].offset);
  }, [searchResult.matches, cursor]);

  const handleFileImport = useCallback(async (file: File) => {
    try {
      const newBytes = await readFileToBytes(file);
      setBytes(newBytes);
      setUndoState(initUndo(newBytes));
      setInputText(bytesToHexString(newBytes, true, " "));
      setFileName(file.name);
      setCursor(0);
      saveHistory({
        ts: Date.now(),
        name: file.name,
        size: newBytes.length,
        hexPreview: bytesToHexString(newBytes.subarray(0, 32), true, " "),
      });
      setHistory(loadHistory());
      toast.success(`Imported ${file.name} (${formatByteSize(newBytes.length)})`);
    } catch (e) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, []);

  const handleDownload = useCallback(() => {
    const blob = makeDownloadBlob(bytes);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName.endsWith(".bin") ? fileName : `${fileName}.bin`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Downloaded ${a.download}`);
  }, [bytes, fileName]);

  const handleSaveHistory = useCallback(() => {
    if (bytes.length > 0) {
      saveHistory({
        ts: Date.now(),
        name: fileName,
        size: bytes.length,
        hexPreview: bytesToHexString(bytes.subarray(0, 32), true, " "),
      });
      setHistory(loadHistory());
    }
  }, [bytes, fileName]);

  const handleShare = useCallback(() => {
    handleSaveHistory();
    return buildShareUrl(bytes);
  }, [bytes, handleSaveHistory]);

  const handleClear = useCallback(() => {
    setBytes(new Uint8Array(0));
    setUndoState(initUndo(new Uint8Array(0)));
    setInputText("");
    setCursor(0);
    setSearchQuery("");
    setGotoText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadFromHistory = useCallback((h: HistoryEntry) => {
    try {
      const newBytes = hexStringToBytes(h.hexPreview);
      setBytes(newBytes);
      setUndoState(initUndo(newBytes));
      setInputText(bytesToHexString(newBytes, true, " "));
      setFileName(h.name);
      setCursor(0);
    } catch {
      toast.error("Could not restore this entry");
    }
  }, []);

  const matchOffsets = useMemo(
    () => new Set(searchResult.matches.flatMap((m) => Array.from({ length: m.length }, (_, i) => m.offset + i))),
    [searchResult.matches],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="hex-input" className="text-sm font-semibold">Input (hex bytes or text)</Label>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFileImport(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="h-3.5 w-3.5" /> Import file
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleUndo} disabled={undoState.past.length === 0}>
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRedo} disabled={undoState.future.length === 0}>
                <Redo2 className="h-3.5 w-3.5" /> Redo
              </Button>
            </div>
          </div>
          <Textarea
            id="hex-input"
            value={inputText}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="FF D8 FF E0 00 10 4A 46 49 46 ...  (or paste ASCII text)"
            className="min-h-[80px] resize-y font-mono text-xs"
          />
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Bytes/line:</span>
              <select
                value={bytesPerLine}
                onChange={(e) => setBytesPerLine(Number(e.target.value))}
                className="h-7 rounded border bg-background px-1"
              >
                {SUPPORTED_BYTES_PER_LINE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Group:</span>
              <select
                value={groupSize}
                onChange={(e) => setGroupSize(Number(e.target.value))}
                className="h-7 rounded border bg-background px-1"
              >
                {SUPPORTED_GROUP_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Format:</span>
              <select
                value={displayFormat}
                onChange={(e) => setDisplayFormat(e.target.value as DisplayFormat)}
                className="h-7 rounded border bg-background px-1"
              >
                <option value="hex">Hex</option>
                <option value="dec">Decimal</option>
                <option value="bin">Binary</option>
                <option value="oct">Octal</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">Offset:</span>
              <select
                value={offsetBase}
                onChange={(e) => setOffsetBase(e.target.value as "hex" | "dec")}
                className="h-7 rounded border bg-background px-1"
              >
                <option value="hex">Hex</option>
                <option value="dec">Decimal</option>
              </select>
            </div>
            <Badge variant="secondary">{bytes.length} bytes</Badge>
            {fileType && (
              <Badge variant="outline" className="text-[10px] flex items-center gap-1">
                <Tag className="h-3 w-3" /> {fileType.name}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {bytes.length === 0 ? (
        <EmptyState
          title="Paste hex bytes, ASCII text, or import a file"
          hint="Bytes never leave the browser. The hex dump, search, inspector, and checksums all run client-side."
          icon={<Binary className="h-8 w-8" />}
        />
      ) : (
        <>
          {/* Hex dump grid */}
          <Card>
            <CardContent className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> Hex dump — cursor at 0x{cursor.toString(16).toUpperCase()}
                </h3>
                <div className="text-[11px] text-muted-foreground">
                  Click a byte to set cursor · right-click to delete · shift+click to insert
                </div>
              </div>
              <div className="font-mono text-[11px] leading-tight overflow-auto max-h-[500px] rounded border bg-background p-2">
                {lines.map((line) => (
                  <div key={line.offset} className="flex gap-3 hover:bg-accent/50 px-1">
                    <span className="text-muted-foreground select-none w-24 flex-shrink-0">
                      {offsetBase === "hex"
                        ? line.offset.toString(16).padStart(8, "0").toUpperCase()
                        : line.offset.toString(10).padStart(10, "0")}
                    </span>
                    <span className="flex-1 break-all">
                      {Array.from({ length: line.bytes.length }).map((_, i) => {
                        const absIdx = line.offset + i;
                        const b = line.bytes[i];
                        const isCursor = absIdx === cursor;
                        const isMatch = matchOffsets.has(absIdx);
                        const display = formatByte(b, displayFormat);
                        return (
                          <span
                            key={absIdx}
                            onClick={() => setCursor(absIdx)}
                            onContextMenu={(e) => { e.preventDefault(); handleDelete(absIdx); }}
                            onDoubleClick={(e) => { e.preventDefault(); handleInsert(absIdx + 1, 0); }}
                            title={`Offset 0x${absIdx.toString(16).toUpperCase()} — click to set cursor, right-click to delete, double-click to insert after`}
                            className={`cursor-pointer px-0.5 rounded ${isCursor ? "bg-primary text-primary-foreground" : isMatch ? "bg-yellow-500/30" : "hover:bg-accent"}`}
                          >
                            {display}
                          </span>
                        );
                      })}
                    </span>
                    <span className="text-muted-foreground select-none w-40 flex-shrink-0">
                      {line.bytes.map((b, i) => {
                        const absIdx = line.offset + i;
                        const isCursor = absIdx === cursor;
                        return (
                          <span key={i} className={isCursor ? "bg-primary text-primary-foreground px-0" : ""}>
                            {byteToAscii(b)}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <CopyButton getText={() => { handleSaveHistory(); return dumpText; }} label="Copy dump" />
                <DownloadButton getText={() => dumpText} filename="hex-dump.txt" mime="text/plain" label="Dump .txt" />
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownload}>
                  <FileUp className="h-3.5 w-3.5" /> Export bytes
                </Button>
                <ShareButton getUrl={handleShare} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {/* Edit current byte */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                Edit byte at offset 0x{cursor.toString(16).toUpperCase()}
              </h3>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">Current:</span>
                <Badge variant="secondary" className="font-mono">{byteToHex(cursorByte)}</Badge>
                <span className="text-muted-foreground">Decimal:</span>
                <Badge variant="outline" className="font-mono">{cursorByte}</Badge>
                <span className="text-muted-foreground">New hex:</span>
                <Input
                  className="h-7 w-20 font-mono text-xs"
                  placeholder="FF"
                  maxLength={2}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (/^[0-9a-fA-F]{2}$/.test(v)) {
                      handleSetByte(cursor, parseInt(v, 16));
                    }
                  }}
                />
                <Button variant="outline" size="sm" onClick={() => handleInsert(cursor + 1, 0)}>
                  Insert 0x00 after
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(cursor)}>
                  Delete byte
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Search & goto */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Search</Label>
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={searchMode === "hex" ? "FF D8 FF" : searchMode === "text" ? "JFIF" : "J.IF"}
                    className="font-mono text-xs h-8"
                  />
                </div>
                <div>
                  <Label className="text-xs">Mode</Label>
                  <select
                    value={searchMode}
                    onChange={(e) => setSearchMode(e.target.value as SearchMode)}
                    className="h-8 text-xs rounded border bg-background px-2"
                  >
                    <option value="hex">Hex bytes</option>
                    <option value="text">ASCII text</option>
                    <option value="regex">Regex (ASCII)</option>
                  </select>
                </div>
                <Button variant="outline" size="sm" onClick={handleSearchPrev} disabled={searchResult.matches.length === 0}>
                  <ChevronLeft className="h-3.5 w-3.5" /> Prev
                </Button>
                <Button variant="outline" size="sm" onClick={handleSearchNext} disabled={searchResult.matches.length === 0}>
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              {searchResult.error && <ErrorBanner message={`Search error: ${searchResult.error}`} />}
              {!searchResult.error && searchQuery && (
                <div className="text-xs text-muted-foreground">
                  <Search className="h-3 w-3 inline mr-1" />
                  {searchResult.matches.length} match{searchResult.matches.length === 1 ? "" : "es"}
                  {searchResult.matches.length > 0 && searchResult.matches.length <= 20 && (
                    <span> — offsets: {searchResult.matches.map((m) => `0x${m.offset.toString(16).toUpperCase()}`).join(", ")}</span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-end gap-2 pt-2 border-t">
                <div className="flex-1 min-w-[200px]">
                  <Label className="text-xs">Goto offset (hex like 0x1F or 1F, or decimal)</Label>
                  <Input
                    value={gotoText}
                    onChange={(e) => setGotoText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleGoto(); }}
                    placeholder="0xFF"
                    className="font-mono text-xs h-8"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={handleGoto}>Go</Button>
              </div>
            </CardContent>
          </Card>

          {/* Data inspector */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <FileText className="h-4 w-4" /> Data inspector @ 0x{cursor.toString(16).toUpperCase()}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                {inspectorRows.map((row) => (
                  <div key={row.type} className="rounded border bg-background px-2 py-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {INSPECTOR_LABELS[row.type]}
                    </div>
                    {row.values.map((v, i) => (
                      <div key={i} className="font-mono break-all">
                        {row.values.length > 1 && (
                          <Badge variant="outline" className="text-[8px] mr-1">{v.endian}</Badge>
                        )}
                        {v.value}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Checksums */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Selection checksums (all {bytes.length} bytes)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                {Object.entries(checksums).map(([algo, val]) => (
                  <div key={algo} className="rounded border bg-background px-2 py-1">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{algo}</div>
                    <div className="font-mono break-all">{val}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1 max-h-[300px] overflow-auto">
              {history.slice(0, 20).map((h, i) => (
                <button
                  key={i}
                  onClick={() => loadFromHistory(h)}
                  className="w-full text-left rounded border bg-background px-3 py-2 text-xs hover:border-primary/50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FileUp className="h-3 w-3 flex-shrink-0" />
                    <code className="font-mono text-foreground truncate flex-1">{h.name}</code>
                    <Badge variant="outline" className="text-[10px] flex-shrink-0">{formatByteSize(h.size)}</Badge>
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground truncate mt-0.5">{h.hexPreview}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> Privacy:
            </strong>{" "}
            All byte processing runs locally in your browser. Files are read via FileReader and never uploaded. The hex grid supports in-place editing (click), insert (double-click), delete (right-click), full undo / redo, and a live data inspector decoding every numeric type and string encoding in both endiannesses.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
