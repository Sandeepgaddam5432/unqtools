"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner, EmptyState } from "../../_shared";
import { parse, summarize, type PemParseResult } from "./logic";

const SAMPLE_PEM = `-----BEGIN CERTIFICATE-----
MIIBcDCCARagAwIBAgICHQAwCgYIKoZIzj0EAwIwGjEYMBYGA1UEAwwPdW5xdG9v
bHMtdGVzdC1jYTAeFw0yNDAxMDEwMDAwMDBaFw0yNTAxMDEwMDAwMDBaMBsxGTAX
BgNVBAMMEHVucXRvb2xzLXRlc3QtY2EwWTATBgcqhkjOPQIBBggqhkjOPQMBBwNC
AATT6+Uz5QXVD6cJjozKcGaA7v8eRPhQpYXmhJpK9IHUjJwQ9xnZ/aZZDl5XK2lI
u3RBqQIwCgYIKoZIzj0EAwIDSAAwRQIhAP+Q6s0Gz8FpZ3o5o2l3Vp2yGx5b5w9u
M5nQpJWqAibrAiB1n8Yp5wL5eM6p5p5w5p5p5p5p5p5p5p5p5p5p5p5p5p5p5p5p
-----END CERTIFICATE-----`;

export default function CertificatePemParser() {
  const [input, setInput] = useState(SAMPLE_PEM);
  const [result, setResult] = useState<PemParseResult | null>(null);

  const run = useCallback(() => {
    setResult(parse(input));
  }, [input]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">PEM input</Label>
            <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[140px] font-mono" value={input} onChange={(e) => setInput(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={run}>Parse</Button>
            <Button size="sm" variant="ghost" onClick={() => { setInput(""); setResult(null); }}>Clear</Button>
          </div>
        </CardContent>
      </Card>

      {result && !result.valid && <ErrorBanner message={result.errors.join(" ")} />}

      {result && result.valid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">{result.type}</Badge>
              <Badge variant="outline">{result.der.length} bytes DER</Badge>
              <Badge variant="outline">{result.base64.length} chars base64</Badge>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => result.base64} label="Copy base64" />
                <DownloadButton getText={() => result.derHex} filename="cert.hex" />
              </div>
            </div>
            {result.warnings.length > 0 && <p className="text-xs text-yellow-700 dark:text-yellow-400">{result.warnings.join(" ")}</p>}
            <div>
              <p className="text-xs text-muted-foreground mb-1">Summary</p>
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap">{summarize(result)}</pre>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">DER (hex) — first 512 chars</p>
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{result.derHex.slice(0, 512)}{result.derHex.length > 512 ? "…" : ""}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      {!result && <EmptyState title="No PEM parsed yet" hint="Paste a PEM block above and click Parse." />}
    </div>
  );
}
