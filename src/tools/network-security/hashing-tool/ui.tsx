"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  decodeInput,
  computeAll,
  computeHmac,
  formatHash,
  compareHashes,
  findMatch,
  detectAlgorithmFromLength,
  resultsToCsv,
  resultsToText,
  formatFileSize,
  getEmptyHash,
  EMPTY_HASHES,
  type InputEncoding,
  type OutputEncoding,
  type HashResult,
  type HashAlgorithm,
} from "./logic";
import { Hash, AlertTriangle, FileText, KeyRound, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

const ALG_ORDER: HashAlgorithm[] = ["MD5", "SHA-1", "SHA-256", "SHA-384", "SHA-512"];

export default function HashingTool() {
  const [text, setText] = useState("");
  const [inputEnc, setInputEnc] = useState<InputEncoding>("utf-8");
  const [outputEnc, setOutputEnc] = useState<OutputEncoding>("hex");
  const [expected, setExpected] = useState("");
  const [results, setResults] = useState<HashResult[] | null>(null);
  const [inputBytes, setInputBytes] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hmacKey, setHmacKey] = useState("");
  const [hmacResults, setHmacResults] = useState<Record<string, string> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const matchedAlg = useMemo(() => {
    if (!results || !expected.trim()) return null;
    return findMatch(results, expected, outputEnc);
  }, [results, expected, outputEnc]);

  const expectedAlg = useMemo(() => (expected.trim() ? detectAlgorithmFromLength(expected) : null), [expected]);

  const doHash = useCallback(async (bytes: Uint8Array, label?: string) => {
    setBusy(true);
    setError(null);
    try {
      const r = await computeAll(bytes);
      setResults(r);
      setInputBytes(bytes.length);
      setFileName(label ?? null);
      if (hmacKey.trim()) {
        const keyBytes = new TextEncoder().encode(hmacKey);
        const hmacs: Record<string, string> = {};
        for (const alg of ["SHA-256", "SHA-384", "SHA-512"] as HashAlgorithm[]) {
          if (alg === "MD5") continue;
          try {
            hmacs[alg] = await computeHmac(alg, bytes, keyBytes);
          } catch {
            /* skip */
          }
        }
        setHmacResults(hmacs);
      } else {
        setHmacResults(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    } finally {
      setBusy(false);
    }
  }, [hmacKey]);

  const handleTextHash = useCallback(() => {
    if (!text.trim() && text !== "") {
      setResults(null);
      return;
    }
    try {
      const bytes = decodeInput(text, inputEnc);
      void doHash(bytes);
    } catch (e) {
      setError((e as Error).message);
      setResults(null);
    }
  }, [text, inputEnc, doHash]);

  const handleFile = useCallback(async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      await doHash(bytes, file.name);
      toast.success(`Hashed ${file.name} (${formatFileSize(bytes.length)})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [doHash]);

  const onFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) void handleFile(f);
  }, [handleFile]);

  const handleClear = useCallback(() => {
    setText("");
    setResults(null);
    setHmacResults(null);
    setError(null);
    setExpected("");
    setFileName(null);
    setHmacKey("");
    if (fileRef.current) fileRef.current.value = "";
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> Input</Label>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr_120px_1fr] gap-2">
            <Label className="text-[11px] text-muted-foreground self-center">Input encoding</Label>
            <select value={inputEnc} onChange={(e) => setInputEnc(e.target.value as InputEncoding)} className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="utf-8">UTF-8 text</option>
              <option value="hex">Hex</option>
              <option value="base64">Base64</option>
            </select>
            <Label className="text-[11px] text-muted-foreground self-center">Output</Label>
            <select value={outputEnc} onChange={(e) => setOutputEnc(e.target.value as OutputEncoding)} className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="hex">Hex (lowercase)</option>
              <option value="base64">Base64</option>
            </select>
          </div>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type text to hash…" className="min-h-[80px] font-mono text-xs resize-y" spellCheck={false} />
          <div className="flex flex-wrap gap-2 items-center">
            <button type="button" onClick={handleTextHash} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50">
              {busy ? "Hashing…" : "Hash text"}
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer disabled:opacity-50">
              <FileText className="h-3 w-3" /> Pick file
            </button>
            <button type="button" onClick={handleClear} className="px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer">Clear</button>
          </div>
          <input ref={fileRef} type="file" onChange={onFilePick} className="hidden" />
          <div
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            className="rounded-md border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground"
          >
            …or drop a file here. Files are read locally and never uploaded.
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-xs text-muted-foreground">HMAC key (optional — enables HMAC-SHA-256/384/512)</Label>
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <Input type="text" value={hmacKey} onChange={(e) => setHmacKey(e.target.value)} placeholder="HMAC secret key" className="font-mono text-xs" />
          </div>
        </CardContent>
      </Card>

      {results && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-semibold">Results</Label>
                <div className="text-[11px] text-muted-foreground">
                  {fileName ? `${fileName} · ` : ""}{formatFileSize(inputBytes)} · {inputBytes} bytes
                </div>
              </div>
              <div className="space-y-1.5">
                {ALG_ORDER.map((alg) => {
                  const r = results.find((x) => x.algorithm === alg);
                  if (!r) return null;
                  const value = formatHash(r, outputEnc);
                  return (
                    <div key={alg} className="grid grid-cols-[80px_1fr_auto] gap-2 items-center py-1 border-b border-border/40 last:border-0">
                      <div className="flex items-center gap-1">
                        <code className="font-mono text-xs font-semibold">{alg}</code>
                        {r.brokenForSecurity && (
                          <Badge variant="outline" className="text-[8px] uppercase border-amber-500/30 text-amber-600 px-1 py-0">broken</Badge>
                        )}
                      </div>
                      <code className="font-mono text-[11px] text-muted-foreground break-all">{value}</code>
                      <CopyButton getText={() => value} label="" size="sm" />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {hmacResults && Object.keys(hmacResults).length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> HMAC results</Label>
                <div className="space-y-1.5">
                  {Object.entries(hmacResults).map(([alg, hex]) => (
                    <div key={alg} className="grid grid-cols-[80px_1fr_auto] gap-2 items-center py-1 border-b border-border/40 last:border-0">
                      <code className="font-mono text-xs font-semibold">{alg}</code>
                      <code className="font-mono text-[11px] text-muted-foreground break-all">{hex}</code>
                      <CopyButton getText={() => hex} label="" size="sm" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Compare to expected</Label>
              <Input type="text" value={expected} onChange={(e) => setExpected(e.target.value)} placeholder="Paste expected hash (hex or base64)…" className="font-mono text-xs" />
              {expected.trim() && (
                <div className="text-xs">
                  {matchedAlg ? (
                    <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-4 w-4" /> Match: {matchedAlg}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                      <XCircle className="h-4 w-4" /> No match{expectedAlg ? ` (expected alg by length: ${expectedAlg})` : ""}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Export</Label>
              <div className="flex flex-wrap gap-2">
                <DownloadButton getText={() => resultsToText(results, inputEnc, inputBytes)} filename="hashes.txt" label="Download .txt" />
                <DownloadButton getText={() => resultsToCsv(results, inputEnc, inputBytes)} filename="hashes.csv" label="Download .csv" mime="text/csv" />
              </div>
            </CardContent>
          </Card>

          {(results.some((r) => r.brokenForSecurity)) && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <strong>Security warning:</strong> MD5 and SHA-1 are cryptographically broken (collisions are practical). Use them only for non-security checksums. For any security-sensitive purpose — password hashing, integrity of signed data, certificate fingerprints — use SHA-256 or stronger.
              </div>
            </div>
          )}
        </>
      )}

      {!results && !error && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs text-muted-foreground">Empty-string reference hashes (sanity check)</Label>
            <div className="space-y-1">
              {ALG_ORDER.map((alg) => (
                <div key={alg} className="grid grid-cols-[80px_1fr] gap-2 text-[11px]">
                  <code className="font-mono font-semibold">{alg}</code>
                  <code className="font-mono text-muted-foreground break-all">{getEmptyHash(alg)}</code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!results && (
        <EmptyState title="Hash text or files — all algorithms at once" hint="MD5, SHA-1, SHA-256/384/512 computed simultaneously, 100% in-browser. Optional HMAC mode. Files never leave your device." icon={<Hash className="h-8 w-8" />} />
      )}
    </div>
  );
}
