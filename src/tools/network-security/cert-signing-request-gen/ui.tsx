"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner, CopyButton, DownloadButton } from "../../_shared";
import { parseCSR, CSR_REFERENCE } from "./logic";

const SAMPLE = `-----BEGIN CERTIFICATE REQUEST-----
MIICVDCCATwCAQAwDzENMAsGA1UEAwwEdGVzdDCCASIwDQYJKoZIhvcNAQEBBQAD
ggEPADCCAQoCggEBAOn4F9G+IiCt/Zy7H3pwIozm1O8w9v8sL5YQk1p0lYQ5UnJ
yZqG6o3u3H9S5t3+WnJr2tI2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA
-----END CERTIFICATE REQUEST-----`;

export default function CertSigningRequestGen() {
  const [input, setInput] = useState<string>("");
  const result = useMemo(() => (input.trim() ? parseCSR(input) : null), [input]);

  const summary = useMemo(() => {
    if (!result) return "";
    const lines = [
      `PEM header: ${result.hasPemHeader}`,
      `PEM footer: ${result.hasPemFooter}`,
      `DER bytes: ${result.derByteLength}`,
      `Outer tag: 0x${result.outerTag.toString(16)}`,
      `Outer length: ${result.outerLength}`,
      `Subject block: ${result.subjectBlock ? "present" : "absent"}`,
      `Public key block: ${result.publicKeyBlock ? "present" : "absent"}`,
      result.errors.length ? `Errors: ${result.errors.join("; ")}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }, [result]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label htmlFor="csr-input" className="text-xs text-muted-foreground">
            Paste a Certificate Signing Request (PEM)
          </Label>
          <textarea
            id="csr-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={SAMPLE}
            className="min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
          />
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setInput(SAMPLE)} className="text-[11px] text-primary hover:underline">Load sample</button>
            <button onClick={() => setInput("")} className="text-[11px] text-muted-foreground hover:underline">Clear</button>
          </div>
        </CardContent>
      </Card>

      {result && result.errors.length > 0 && <ErrorBanner message={result.errors.join("; ")} />}

      {result && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[11px]">DER</Badge>
              <span className="text-xs text-muted-foreground">{result.derByteLength} bytes</span>
              <div className="ml-auto flex gap-2">
                <CopyButton getText={() => summary} label="Copy" />
                <DownloadButton getText={() => summary} filename="csr-info.txt" />
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <Cell label="PEM header" value={result.hasPemHeader ? "Yes" : "No"} />
              <Cell label="PEM footer" value={result.hasPemFooter ? "Yes" : "No"} />
              <Cell label="Outer tag" value={`0x${result.outerTag.toString(16)}`} />
              <Cell label="Outer length" value={String(result.outerLength)} />
              <Cell label="Subject block" value={result.subjectBlock ? "Present" : "—"} />
              <Cell label="Public key block" value={result.publicKeyBlock ? "Present" : "—"} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-semibold">CSR reference</p>
          <div className="rounded border bg-muted/30 p-2 text-xs font-mono break-all">
            {CSR_REFERENCE.opensslCommand}
          </div>
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground">Subject fields</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {CSR_REFERENCE.fields.map((f) => (
                <div key={f.code} className="rounded border bg-background px-2 py-1 text-xs">
                  <span className="font-mono font-semibold">{f.code}</span> — {f.name}
                  <span className="block text-[10px] text-muted-foreground">{f.example}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> parsing runs locally. The CSR never leaves your browser.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border bg-background px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm text-foreground break-all">{value}</div>
    </div>
  );
}
