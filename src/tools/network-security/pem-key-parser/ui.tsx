"use client";

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { parsePemSync } from "./logic";

export default function PemKeyParser() {
  const [input, setInput] = useState("");
  const [fingerprint, setFingerprint] = useState("");

  const info = useMemo(() => (input.trim() ? parsePemSync(input) : null), [input]);

  // Compute fingerprint asynchronously without blocking render.
  React.useEffect(() => {
    let cancelled = false;
    setFingerprint("");
    if (!info?.isValid) return;
    import("./logic").then(async (mod) => {
      const full = await mod.parsePem(input);
      if (!cancelled) setFingerprint(full.fingerprint);
    });
    return () => { cancelled = true; };
  }, [info, input]);

  const rows = useMemo(() => {
    if (!info?.isValid) return [];
    return [
      { label: "Type", value: info.label },
      { label: "Algorithm", value: info.algorithm },
      { label: "Base64 length", value: `${info.base64Length} chars` },
      { label: "DER byte length", value: `${info.derByteLength} bytes` },
      { label: "Fingerprint (SHA-256)", value: fingerprint || "…" },
      ...Object.entries(info.headers).map(([k, v]) => ({ label: k, value: v })),
    ];
  }, [info, fingerprint]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="pem-input" className="text-xs text-muted-foreground">
            Paste a PEM key or certificate
          </Label>
          <Textarea
            id="pem-input"
            placeholder={"-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-xs min-h-[160px]"
          />
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              className="text-primary hover:underline cursor-pointer"
              onClick={() => setInput("-----BEGIN CERTIFICATE-----\nMIIDBzCCAnCgAwIBAgICEAAwDQYJKoZIhvcNAQELBQAwMzELMAkGA1UEBhMC\nVVMxCzAJBgNVBAMMAkNBMB4XDTI0MDEwMTAwMDAwMFoXDTI1MDEwMTAwMDAwMFow\n-----END CERTIFICATE-----")}
            >
              Load sample certificate
            </button>
            <button
              type="button"
              className="text-muted-foreground hover:underline cursor-pointer"
              onClick={() => setInput("")}
            >
              Clear
            </button>
          </div>
        </CardContent>
      </Card>

      {info && !info.isValid && <ErrorBanner message={info.error ?? "Invalid PEM"} />}

      {info?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="text-xs">{info.label}</Badge>
              <Badge variant="outline" className="text-xs">{info.algorithm}</Badge>
              <Badge variant="outline" className="text-xs">{info.derByteLength} bytes</Badge>
            </div>
            <div className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[160px_1fr_auto] gap-2 items-center text-xs py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground">{r.label}</span>
                  <code className="font-mono text-foreground break-all">{r.value}</code>
                  <CopyButton getText={() => r.value} label="" size="icon-sm" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!info && (
        <EmptyState
          title="Paste a PEM block to parse"
          hint="Detects RSA, EC, PKCS#8 keys, X.509 certificates, and CSRs. All parsing happens locally."
        />
      )}
    </div>
  );
}
