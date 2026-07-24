"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner } from "../../_shared";
import { parseSshKey, md5, formatMd5Fingerprint, generateRandomart, generateAuthorizedKeysEntry, bytesToHex, type SshKeyInfo } from "./logic";

export default function SshKeyFingerprintExplorer() {
  const [input, setInput] = useState("");
  const [info, setInfo] = useState<SshKeyInfo | null>(null);
  const [md5Fp, setMd5Fp] = useState("");
  const [sha256Fp, setSha256Fp] = useState("");
  const [sha512Fp, setSha512Fp] = useState("");
  const [randomart, setRandomart] = useState("");
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    setError(null);
    try {
      const parsed = parseSshKey(input);
      if ("error" in parsed) { setError(parsed.error); setInfo(null); return; }
      setInfo(parsed);

      // MD5 fingerprint
      const md5Hex = md5(parsed.rawBytes);
      setMd5Fp(formatMd5Fingerprint(md5Hex));
      setRandomart(generateRandomart(md5Hex));

      // SHA-256 fingerprint (base64) via Web Crypto
      const sha256Buf = await crypto.subtle.digest("SHA-256", parsed.rawBytes as BufferSource);
      const sha256Bytes = new Uint8Array(sha256Buf);
      const sha256B64 = btoa(String.fromCharCode(...sha256Bytes));
      setSha256Fp(`SHA256:${sha256B64}`);

      // SHA-512 fingerprint (hex)
      const sha512Buf = await crypto.subtle.digest("SHA-512", parsed.rawBytes as BufferSource);
      setSha512Fp(`SHA512:${bytesToHex(new Uint8Array(sha512Buf))}`);
    } catch (e) {
      setError(`Analysis failed: ${(e as Error).message}`);
    }
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">SSH public key</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} placeholder="ssh-ed25519 AAAA... user@host" />
          </div>
          <Button size="sm" onClick={analyze} disabled={!input}>Analyze</Button>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {info && !error && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Type</p><p className="text-sm font-bold">{info.type}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Bits</p><p className="text-sm font-bold">{info.bitCount || "?"}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Valid?</p><p className="text-sm font-bold">{info.isValid ? "✅" : "❌"}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Comment</p><p className="text-sm font-bold truncate">{info.comment || "(none)"}</p></CardContent></Card>
          </div>

          {info.errors.length > 0 && (
            <Card><CardContent className="p-3 space-y-1">
              {info.errors.map((e, i) => <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ {e}</p>)}
            </CardContent></Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">MD5 fingerprint</CardTitle>
                <CopyButton getText={() => md5Fp} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-sm p-4 bg-muted/40 rounded-b-lg font-mono">{md5Fp}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">SHA256 fingerprint</CardTitle>
                <CopyButton getText={() => sha256Fp} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs p-4 bg-muted/40 rounded-b-lg font-mono break-all whitespace-pre-wrap">{sha256Fp}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">SHA512 fingerprint (hex)</CardTitle>
                <CopyButton getText={() => sha512Fp} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs p-4 bg-muted/40 rounded-b-lg font-mono break-all whitespace-pre-wrap">{sha512Fp}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Randomart visualization</CardTitle></CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs p-4 bg-muted/40 rounded-b-lg font-mono">{randomart}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">authorized_keys entry</CardTitle>
                <CopyButton getText={() => generateAuthorizedKeysEntry(info)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs p-4 bg-muted/40 rounded-b-lg font-mono break-all whitespace-pre-wrap">{generateAuthorizedKeysEntry(info)}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Raw bytes (hex, first 64 bytes)</CardTitle></CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs p-4 bg-muted/40 rounded-b-lg font-mono break-all whitespace-pre-wrap">{bytesToHex(info.rawBytes.slice(0, 64))}</pre>
            </CardContent>
          </Card>
        </>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all parsing + hashing runs locally via Web Crypto API. No key leaves your browser.</p></CardContent></Card>
    </div>
  );
}
