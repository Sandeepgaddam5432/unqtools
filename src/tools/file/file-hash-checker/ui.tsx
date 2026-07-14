"use client";
import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  hashFileAll, compareHashes, detectAlgorithmFromLength, diffHashes,
  formatBytes, parseChecksumFile, batchToCsv, batchToJson,
  loadHashHistory, saveHashToHistory, clearHashHistory,
  SUPPORTED_ALGORITHMS, ALGORITHM_INFO, formatHash,
  type HashAlgorithm, type HashHistoryEntry,
} from "./logic";
import { Upload, CheckCircle2, XCircle, Download, History, AlertTriangle } from "lucide-react";

export default function FileHashChecker() {
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<Record<string, string> | null>(null);
  const [expectedHash, setExpectedHash] = useState("");
  const [hashFormat, setHashFormat] = useState<"lower" | "upper" | "base64">("lower");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HashHistoryEntry[]>(() => loadHashHistory());
  const [showHistory, setShowHistory] = useState(false);

  const handleFiles = useCallback(async (newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return;
    const fileArray = Array.from(newFiles);
    setFiles(fileFiles => [...fileFiles, ...fileArray]);
    setError(null);
    setWorking(true);
    try {
      const hashResults = await hashFileAll(fileArray[0], SUPPORTED_ALGORITHMS as unknown as HashAlgorithm[]);
      setResults(hashResults);
      const entry: HashHistoryEntry = {
        filename: fileArray[0].name,
        algorithm: "SHA-256",
        hash: hashResults["SHA-256"],
        size: fileArray[0].size,
        computedAt: new Date().toISOString(),
      };
      setHistory(saveHashToHistory(entry));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }, []);

  const expectedAlg = expectedHash.trim() ? detectAlgorithmFromLength(expectedHash.trim()) : null;
  const matchResult = results && expectedHash.trim() && expectedAlg
    ? compareHashes(results[expectedAlg] ?? "", expectedHash.trim())
    : null;
  const diff = matchResult === false && expectedAlg
    ? diffHashes(results?.[expectedAlg] ?? "", expectedHash.trim())
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <input
            type="file"
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="file-hash-input"
            aria-label="Choose files to hash"
          />
          <button
            type="button"
            onClick={() => document.getElementById("file-hash-input")?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            className="w-full rounded-xl border-2 border-dashed border-border p-8 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">All hashes computed at once — no size limit</p>
          </button>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Files ({files.length})</Label>
            {files.map((f, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                <span className="truncate">{f.name}</span>
                <Badge variant="outline" className="font-mono text-[10px]">{formatBytes(f.size)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {working && (
        <Card><CardContent className="p-4 text-center text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-2" />
          Hashing...
        </CardContent></Card>
      )}

      {error && <ErrorBanner message={error} />}

      {results && !working && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Hashes</Label>
                <select value={hashFormat} onChange={(e) => setHashFormat(e.target.value as "lower" | "upper" | "base64")}
                  className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer" aria-label="Hash format">
                  <option value="lower">lowercase hex</option>
                  <option value="upper">UPPERCASE hex</option>
                  <option value="base64">Base64</option>
                </select>
              </div>
              <div className="space-y-2">
                {SUPPORTED_ALGORITHMS.map((alg) => {
                  const hash = results[alg];
                  if (!hash) return null;
                  const formatted = formatHash(hash, hashFormat);
                  const info = ALGORITHM_INFO[alg];
                  return (
                    <div key={alg} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-mono font-semibold">{alg}</Label>
                        {info.deprecated && <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-600">deprecated</Badge>}
                        <span className="text-[10px] text-muted-foreground">{info.description}</span>
                        <CopyButton getText={() => formatted} label="" size="icon-sm" />
                      </div>
                      <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-2 font-mono text-xs break-all">{formatted}</pre>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Verify against expected hash</Label>
              <Input
                placeholder="Paste expected hash to verify..."
                value={expectedHash}
                onChange={(e) => setExpectedHash(e.target.value)}
                className="font-mono text-sm"
                aria-label="Expected hash"
              />
              {expectedAlg && (
                <Badge variant="outline" className="text-[10px]">Detected: {expectedAlg}</Badge>
              )}
              {matchResult === true && (
                <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" /> MATCH — file hash matches expected value
                </div>
              )}
              {matchResult === false && expectedAlg && (
                <>
                  <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-400">
                    <XCircle className="h-5 w-5" /> NO MATCH — file hash differs from expected
                  </div>
                  {diff && (
                    <div className="rounded-md border p-2">
                      <p className="text-[10px] text-muted-foreground mb-1">Diff (red = mismatch):</p>
                      <code className="font-mono text-xs break-all">
                        {diff.map((c, i) => (
                          <span key={i} className={c.match ? "" : "bg-red-500/20 text-red-600 dark:text-red-400"}>{c.char}</span>
                        ))}
                      </code>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Checksum file parser</Label>
                <button type="button" onClick={() => setShowHistory(!showHistory)} className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
                  History ({history.length})
                </button>
              </div>
              <Textarea
                placeholder="Paste SHASUMS / .sha256 file content..."
                className="min-h-[60px] font-mono text-xs resize-y"
                onChange={(e) => {
                  const entries = parseChecksumFile(e.target.value);
                  if (entries.length > 0) {
                    toast.info(`Parsed ${entries.length} checksum entries`);
                  }
                }}
                aria-label="Checksum file content"
              />
            </CardContent>
          </Card>

          {showHistory && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">History ({history.length})</Label>
                  {history.length > 0 && (
                    <button type="button" onClick={() => { clearHashHistory(); setHistory([]); }} className="text-xs text-red-600 hover:underline cursor-pointer">Clear</button>
                  )}
                </div>
                {history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No history yet.</p>
                ) : (
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {history.map((h, i) => (
                      <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{h.filename}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{h.hash.slice(0, 20)}... ({h.algorithm})</p>
                        </div>
                        <Badge variant="outline" className="text-[9px]">{formatBytes(h.size)}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {!files.length && !error && (
        <EmptyState title="Drop a file to hash" hint="MD5, SHA-1, SHA-256, SHA-512, CRC32 — all computed at once. 100% local, unlimited size." icon={<Upload className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> all hashing runs in your browser via WebCrypto. Files never leave your device.
            {ALGORITHM_INFO["MD5"].deprecated && <span className="ml-1"><AlertTriangle className="inline h-3 w-3" /> MD5/SHA-1 are deprecated — use SHA-256+ for security.</span>}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
