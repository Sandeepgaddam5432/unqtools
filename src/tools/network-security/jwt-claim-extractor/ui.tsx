"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import { decodeJwt, extractClaims, epochToIso } from "./logic";

export default function JwtClaimExtractor() {
  const [jwt, setJwt] = useState("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  const [error, setError] = useState<string | null>(null);

  const decoded = useMemo(() => {
    const r = decodeJwt(jwt);
    if ("error" in r) { setError(r.error); return null; }
    setError(null);
    return r;
  }, [jwt]);

  const claims = decoded ? extractClaims(decoded.payload) : {};
  const payloadObj = decoded && typeof decoded.payload === "object" && decoded.payload ? decoded.payload as Record<string, unknown> : {};

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-xs text-muted-foreground">JWT token</Label>
          <textarea className="rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] font-mono break-all" value={jwt} onChange={(e) => setJwt(e.target.value)} />
          <p className="text-xs text-muted-foreground">Signature is NOT verified — only decoded.</p>
        </CardContent>
      </Card>

      {error && <ErrorBanner message={error} />}

      {decoded && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Decoded payload</Label>
              <div className="flex gap-2">
                <CopyButton getText={() => JSON.stringify(decoded.payload, null, 2)} />
                <DownloadButton getText={() => JSON.stringify(decoded.payload, null, 2)} filename="jwt-payload.json" />
              </div>
            </div>
            <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-md font-mono whitespace-pre-wrap break-all">{JSON.stringify(decoded.payload, null, 2)}</pre>
            <div className="space-y-1 text-sm">
              {("exp" in payloadObj && typeof payloadObj.exp === "number") && (
                <p className="text-xs text-muted-foreground">Expires: {epochToIso(payloadObj.exp as number)}</p>
              )}
              {("iat" in payloadObj && typeof payloadObj.iat === "number") && (
                <p className="text-xs text-muted-foreground">Issued at: {epochToIso(payloadObj.iat as number)}</p>
              )}
              {("nbf" in payloadObj && typeof payloadObj.nbf === "number") && (
                <p className="text-xs text-muted-foreground">Not before: {epochToIso(payloadObj.nbf as number)}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all decoding runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
