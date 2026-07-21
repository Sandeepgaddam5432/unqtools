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
} from "../../_shared";
import { toast } from "sonner";
import {
  Binary, FileUp, Search, History, ShieldCheck, ShieldAlert,
  HelpCircle, FileText, Package, Folder,
} from "lucide-react";
import {
  SIGNATURES,
  CATEGORY_LABELS,
  hexStringToBytes,
  bytesToHexString,
  byteToAscii,
  ruleHex,
  renderHexDump,
  renderHexDumpText,
  isHighlighted,
  matchesRule,
  detectAll,
  detect,
  detectZipSubtype,
  extractExtension,
  extensionMatches,
  searchSignatures,
  groupByCategory,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  renderReport,
  type FileCategory,
  type SignatureRule,
  type Verdict,
  type HistoryEntry,
} from "./logic";

const VERDICT_STYLES: Record<Verdict, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  match: {
    bg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: <ShieldCheck className="h-5 w-5" />,
    label: "MATCH",
  },
  spoof: {
    bg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900",
    text: "text-red-700 dark:text-red-300",
    icon: <ShieldAlert className="h-5 w-5" />,
    label: "SPOOF WARNING",
  },
  unknown: {
    bg: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900",
    text: "text-amber-700 dark:text-amber-300",
    icon: <HelpCircle className="h-5 w-5" />,
    label: "UNKNOWN",
  },
};

const CATEGORY_ICONS: Partial<Record<FileCategory, React.ReactNode>> = {
  image: <FileText className="h-3.5 w-3.5" />,
  archive: <Package className="h-3.5 w-3.5" />,
  executable: <Binary className="h-3.5 w-3.5" />,
  document: <FileText className="h-3.5 w-3.5" />,
  audio: <FileText className="h-3.5 w-3.5" />,
  video: <FileText className="h-3.5 w-3.5" />,
  font: <FileText className="h-3.5 w-3.5" />,
  database: <Folder className="h-3.5 w-3.5" />,
};

export default function BinaryFileSignatureInspector() {
  const [inputText, setInputText] = useState("89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52");
  const [bytes, setBytes] = useState<Uint8Array>(() => hexStringToBytes("89 50 4E 47 0D 0A 1A 0A 00 00 00 0D 49 48 44 52"));
  const [fileName, setFileName] = useState("pasted.png");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCat, setSearchCat] = useState<FileCategory | "">("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.bytes.length > 0) {
        setBytes(p.bytes);
        setInputText(bytesToHexString(p.bytes, true, " "));
        toast.info("Loaded from share link");
      } else if (p.truncated) {
        toast.info(`Share link truncated — original was ${p.originalSize} bytes`);
      }
    }
  }, []);

  // Parse input text → bytes
  const parseInput = useCallback((text: string): Uint8Array => {
    if (!text) return new Uint8Array(0);
    try {
      return hexStringToBytes(text);
    } catch {
      // Fall back to ASCII / UTF-8 encoding
      return new TextEncoder().encode(text);
    }
  }, []);

  const handleInputChange = useCallback((text: string) => {
    setInputText(text);
    setBytes(parseInput(text));
  }, [parseInput]);

  const handleFileRead = useCallback(async (file: File) => {
    try {
      // Read up to 64 KB for magic-byte detection
      const sliceSize = Math.min(file.size, 65536);
      const buf = await file.slice(0, sliceSize).arrayBuffer();
      const arr = new Uint8Array(buf);
      setBytes(arr);
      setFileName(file.name);
      setInputText(bytesToHexString(arr, true, " ").slice(0, 4096)); // cap displayed text
      toast.success(`Loaded ${file.name} (${file.size.toLocaleString()} bytes, inspected first ${sliceSize.toLocaleString()})`);
    } catch (e) {
      toast.error(`Could not read file: ${e instanceof Error ? e.message : "unknown error"}`);
    }
  }, []);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleFileRead(file);
  }, [handleFileRead]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFileRead(file);
  }, [handleFileRead]);

  const detection = useMemo(() => detect(bytes, fileName), [bytes, fileName]);
  const zipInfo = useMemo(() => {
    const isZip = detection.primary?.rule.id === "zip" || detection.primary?.rule.id === "zip-empty" || detection.primary?.rule.id === "zip-span";
    if (!isZip) return null;
    return detectZipSubtype(bytes);
  }, [bytes, detection]);

  const hexLines = useMemo(
    () => renderHexDump(bytes, { bytesPerLine: 16, maxBytes: 512 }),
    [bytes],
  );
  const dumpText = useMemo(
    () => renderHexDumpText(bytes, { bytesPerLine: 16, maxBytes: 512 }),
    [bytes],
  );

  const searchResults = useMemo(
    () => searchSignatures({ query: searchQuery, category: searchCat || "" }),
    [searchQuery, searchCat],
  );
  const grouped = useMemo(() => groupByCategory(searchResults), [searchResults]);

  const handleSaveHistory = useCallback(() => {
    if (detection.primary && bytes.length > 0) {
      saveHistory({
        ts: Date.now(),
        fileName: fileName || "(pasted)",
        fileSize: bytes.length,
        detectedName: detection.primary.rule.name,
        verdict: detection.verdict,
        hexPreview: bytesToHexString(bytes.slice(0, 8), true, " "),
      });
      setHistory(loadHistory());
    }
  }, [detection, bytes, fileName]);

  const handleClear = useCallback(() => {
    setInputText("");
    setBytes(new Uint8Array(0));
    setFileName("pasted.bin");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const handleCopyReport = useCallback(() => {
    handleSaveHistory();
    return renderReport(bytes, fileName, detection);
  }, [bytes, fileName, detection, handleSaveHistory]);

  const verdictStyle = VERDICT_STYLES[detection.verdict];

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="bfs-file" className="text-sm font-semibold">Drop a file (or paste hex bytes)</Label>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5"
              >
                <FileUp className="h-3.5 w-3.5" /> Pick file
              </Button>
              <input
                ref={fileInputRef}
                id="bfs-file"
                type="file"
                className="hidden"
                onChange={handleFilePick}
              />
            </div>
          </div>
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`rounded-lg border-2 border-dashed p-3 transition-colors ${isDragging ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <Input
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="filename.ext (used for extension-spoof check)"
              className="mb-2 h-8 text-xs"
            />
            <Textarea
              value={inputText}
              onChange={(e) => handleInputChange(e.target.value)}
              placeholder="89 50 4E 47 0D 0A 1A 0A … or any ASCII text"
              className="min-h-[80px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Drag &amp; drop a binary file, or paste hex bytes (e.g. <code>89504E47</code> or <code>89 50 4E 47</code>) or text. Files are read locally with FileReader — never uploaded.
            </p>
          </div>
        </CardContent>
      </Card>

      {bytes.length > 0 ? (
        <>
          <Card>
            <CardContent className={`p-4 border-2 ${verdictStyle.bg}`}>
              <div className="flex items-center gap-3">
                <div className={verdictStyle.text}>{verdictStyle.icon}</div>
                <div className="flex-1">
                  <div className={`text-base font-bold ${verdictStyle.text}`}>{verdictStyle.label}</div>
                  {detection.primary ? (
                    <div className="text-xs text-foreground mt-0.5">
                      Detected: <span className="font-mono font-semibold">{detection.primary.rule.name}</span>
                      {zipInfo && zipInfo.subtype !== "zip" && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">→ {zipInfo.name}</Badge>
                      )}
                    </div>
                  ) : detection.isPlainText ? (
                    <div className="text-xs text-foreground mt-0.5">No magic-number signature matched — file appears to be plain text (CSV, JSON, log, source code, etc.).</div>
                  ) : (
                    <div className="text-xs text-foreground mt-0.5">No magic-number signature matched — unknown or truncated file.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {detection.primary && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Binary className="h-4 w-4" /> Primary match
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="Format" value={detection.primary.rule.name} />
                  <Stat label="MIME" value={detection.primary.rule.mime} />
                  <Stat label="Extension(s)" value={detection.primary.rule.exts.join(", ")} />
                  <Stat label="Category" value={CATEGORY_LABELS[detection.primary.rule.category]} />
                  <Stat label="Hex magic" value={ruleHex(detection.primary.rule)} mono />
                  <Stat label="Offset" value={`0x${detection.primary.rule.offset.toString(16).toUpperCase()}`} mono />
                  <Stat label="Confidence" value={detection.primary.confidence} />
                  <Stat label="File extension" value={extractExtension(fileName) || "(none)"} />
                </div>
                <p className="text-xs text-muted-foreground pt-1">{detection.primary.rule.description}</p>
                {detection.extensionSpoofed && (
                  <div className="rounded border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800 px-3 py-2 text-xs text-red-700 dark:text-red-300 mt-1">
                    <ShieldAlert className="inline h-3.5 w-3.5 mr-1" />
                    The extension <code>.{extractExtension(fileName)}</code> does not match the detected {detection.primary.rule.name} signature. This may indicate a renamed or spoofed file — verify the source before opening.
                  </div>
                )}
                {zipInfo && zipInfo.subtype !== "zip" && (
                  <div className="rounded border border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 mt-1">
                    <Package className="inline h-3.5 w-3.5 mr-1" />
                    ZIP-based container detected as <strong>{zipInfo.name}</strong> ({zipInfo.ext}) via marker <code>{zipInfo.marker}</code>.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {detection.matches.length > 1 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Other candidates ({detection.matches.length - 1})</h3>
                <div className="space-y-1">
                  {detection.matches.slice(1, 6).map((m, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="outline" className="text-[10px]">{m.confidence}</Badge>
                      <span className="font-mono font-medium text-foreground">{m.rule.name}</span>
                      <span className="text-muted-foreground">— {ruleHex(m.rule)} @ 0x{m.rule.offset.toString(16).toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Binary className="h-4 w-4" /> Hex dump (first 512 bytes; matched bytes highlighted)
              </h3>
              <div className="rounded border bg-background p-3 overflow-auto max-h-[400px]">
                <pre className="text-[11px] leading-tight font-mono whitespace-pre">
                  {hexLines.map((line, lineIdx) => {
                    const highlights = detection.matches.flatMap((m) => m.matchedRanges);
                    return (
                      <div key={lineIdx}>
                        <span className="text-muted-foreground">{line.offset.toString(16).padStart(8, "0").toUpperCase()}</span>{"  "}
                        {line.hex.split(" ").map((h, i) => {
                          const byteIdx = line.offset + i;
                          const hl = isHighlighted(byteIdx, highlights);
                          return (
                            <span key={i} className={hl ? "bg-emerald-200 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-50 rounded px-0.5" : "text-foreground"}>
                              {h}{" "}
                            </span>
                          );
                        })}
                        {" |"}
                        <span className="text-muted-foreground">{line.ascii}</span>
                        {"|"}
                      </div>
                    );
                  })}
                </pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton getText={handleCopyReport} label="Copy report" />
                  <DownloadButton getText={handleCopyReport} filename="file-signature-report.txt" mime="text/plain" label="Download report" />
                  <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(bytes); }} />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Drop a file or paste hex bytes to inspect"
          hint="The tool reads the first/last few KB locally via FileReader, matches against a 100+ entry magic-number database, and warns about extension spoofing. Plain text (CSV, JSON, log) gets a friendly 'no magic' verdict."
          icon={<Binary className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Search className="h-4 w-4" /> Signature database ({SIGNATURES.length} entries)
            </h3>
            <div className="flex flex-wrap gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ext / MIME / name / hex…"
                className="h-8 text-xs w-48"
              />
              <select
                value={searchCat}
                onChange={(e) => setSearchCat(e.target.value as FileCategory | "")}
                className="h-8 text-xs rounded border bg-background px-2"
              >
                <option value="">All categories</option>
                {(Object.keys(CATEGORY_LABELS) as FileCategory[]).map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Showing {searchResults.length} of {SIGNATURES.length} entries
          </div>
          <div className="max-h-[600px] overflow-auto rounded border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="p-2 font-medium">Name</th>
                  <th className="p-2 font-medium">Ext</th>
                  <th className="p-2 font-medium">MIME</th>
                  <th className="p-2 font-medium">Hex magic</th>
                  <th className="p-2 font-medium">Off</th>
                  <th className="p-2 font-medium">Cat</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((r) => {
                  const isMatched = detection.primary?.rule.id === r.id;
                  return (
                    <tr key={r.id} className={`border-t hover:bg-muted/30 ${isMatched ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}>
                      <td className="p-2">
                        <div className="flex items-center gap-1.5">
                          {CATEGORY_ICONS[r.category]}
                          <span className="font-mono font-medium text-foreground">{r.name}</span>
                          {isMatched && <Badge variant="secondary" className="text-[9px]">matched</Badge>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{r.description}</div>
                      </td>
                      <td className="p-2"><Badge variant="outline" className="text-[10px]">{r.exts.join(", ")}</Badge></td>
                      <td className="p-2 font-mono text-[10px] text-muted-foreground">{r.mime}</td>
                      <td className="p-2 font-mono text-[10px] text-foreground">{ruleHex(r)}</td>
                      <td className="p-2 font-mono text-[10px]">0x{r.offset.toString(16).toUpperCase()}</td>
                      <td className="p-2"><Badge variant="outline" className="text-[9px]">{CATEGORY_LABELS[r.category]}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2 text-[9px]">{h.verdict.toUpperCase()}</Badge>
                  <span className="font-mono font-medium text-foreground">{h.fileName}</span>
                  <span className="text-muted-foreground ml-2">→ {h.detectedName}</span>
                  <span className="text-muted-foreground ml-2">· {h.hexPreview}</span>
                  <span className="text-muted-foreground ml-2">· {new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All file inspection runs locally via FileReader. The file is never uploaded — only the bytes needed for identification are read. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
