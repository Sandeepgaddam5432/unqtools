"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  detectAlgorithmFromLength, compareHashes, formatFileSize, resultsToCsv, md5, bufferToHex,
  generateHashlistFile, type FileVerifyResult, type HashAlgorithm, type HashResult,
} from "./logic";

export default function HashVerifier() {
  const [results, setResults] = useState<FileVerifyResult[]>([]);
  const [expectedHash, setExpectedHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const newResults: FileVerifyResult[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i]!;
        const buf = await file.arrayBuffer();
        const bytes = new Uint8Array(buf);

        const hashes: HashResult[] = [];
        // MD5 (Web Crypto doesn't support MD5)
        const md5Hash = md5(bytes);
        hashes.push({ algorithm: "MD5", hash: md5Hash, hashLength: 32 });
        // SHA-1, SHA-256, SHA-384, SHA-512 via Web Crypto
        for (const alg of ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as HashAlgorithm[]) {
          try {
            const hashBuf = await crypto.subtle.digest(alg, bytes as BufferSource);
            const hex = bufferToHex(hashBuf);
            hashes.push({ algorithm: alg, hash: hex, hashLength: hex.length });
          } catch { /* skip */ }
        }

        // Compare against expected
        let isMatch = false;
        let matchedAlg: HashAlgorithm | undefined;
        if (expectedHash) {
          for (const h of hashes) {
            if (compareHashes(h.hash, expectedHash)) {
              isMatch = true;
              matchedAlg = h.algorithm;
              break;
            }
          }
        }

        const warnings: string[] = [];
        if (expectedHash) {
          const detected = detectAlgorithmFromLength(expectedHash);
          if (detected && !isMatch) warnings.push(`Expected hash looks like ${detected} but doesn't match the computed ${detected} hash.`);
          if (!detected) warnings.push("Could not detect algorithm from expected hash length.");
        }

        newResults.push({
          fileName: file.name,
          fileSize: file.size,
          hashes,
          expectedHash: expectedHash || undefined,
          matchedAlgorithm: matchedAlg,
          isMatch,
          warnings,
        });
      }
      setResults([...results, ...newResults]);
    } catch (e) {
      setError(`Hashing failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [results, expectedHash]);

  const detectedExpectedAlg = expectedHash ? detectAlgorithmFromLength(expectedHash) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Expected hash (optional — for verification)</Label>
            <Input value={expectedHash} onChange={(e) => setExpectedHash(e.target.value)} placeholder="e.g. e3b0c44298fc1c14..." />
            {detectedExpectedAlg && <p className="text-xs text-muted-foreground mt-1">Detected algorithm: <Badge variant="outline">{detectedExpectedAlg}</Badge></p>}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <input type="file" id="file-input" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            <Button size="sm" onClick={() => document.getElementById("file-input")?.click()} disabled={busy}>{busy ? "Hashing..." : "Pick file(s)"}</Button>
            <Button size="sm" variant="ghost" onClick={() => { setResults([]); setError(null); }}>Clear</Button>
            {results.length > 0 && <Badge variant="outline">{results.length} file(s)</Badge>}
          </div>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {results.length > 0 && (
        <>
          {results.map((r, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">{r.fileName} <span className="text-muted-foreground font-normal">({formatFileSize(r.fileSize)})</span></CardTitle>
                  {r.expectedHash && (
                    <Badge variant={r.isMatch ? "default" : "destructive"}>{r.isMatch ? "✅ Match" : "❌ Mismatch"}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {r.warnings.length > 0 && (
                  <div className="px-4 pb-2 space-y-1">
                    {r.warnings.map((w, j) => <p key={j} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {w}</p>)}
                  </div>
                )}
                <table className="w-full text-xs">
                  <thead className="bg-muted/80"><tr><th className="p-2 text-left">Algorithm</th><th className="p-2 text-left">Hash</th><th className="p-2 text-right">Actions</th></tr></thead>
                  <tbody>
                    {r.hashes.map((h, j) => (
                      <tr key={j} className="border-t border-border/50">
                        <td className="p-2 font-mono">{h.algorithm}</td>
                        <td className="p-2 font-mono break-all"><span className={r.matchedAlgorithm === h.algorithm ? "text-emerald-600 dark:text-emerald-400 font-bold" : ""}>{h.hash}</span></td>
                        <td className="p-2 text-right"><CopyButton getText={() => h.hash} size="icon-sm" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="p-4 flex items-center justify-between flex-wrap gap-2">
              <p className="text-sm">Export results:</p>
              <div className="flex gap-2">
                <DownloadButton getText={() => resultsToCsv(results)} filename="hash-results.csv" mime="text/csv" />
                <DownloadButton getText={() => generateHashlistFile(results, "SHA-256")} filename="checksums.sha256sum" mime="text/plain" />
                <DownloadButton getText={() => generateHashlistFile(results, "MD5")} filename="checksums.md5sum" mime="text/plain" />
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all hashing runs locally via Web Crypto API + JS MD5 implementation. No file leaves your browser.</p></CardContent></Card>
    </div>
  );
}
