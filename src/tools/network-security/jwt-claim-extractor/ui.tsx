"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, ErrorBanner } from "../../_shared";
import {
  decodeJwt,
  extractClaims,
  extractCustomClaims,
  detectAlg,
  checkExpiry,
  securityWarnings,
  batchDecode,
  batchToCsv,
  prettyJson,
  parseBatchInput,
  epochToIso,
  REGISTERED_CLAIMS,
} from "./logic";

export default function JwtClaimExtractor() {
  const [jwt, setJwt] = useState("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c");
  const [batchText, setBatchText] = useState("");

  const decoded = useMemo(() => decodeJwt(jwt), [jwt]);
  const error = "error" in decoded ? decoded.error : null;
  const ok = !("error" in decoded);

  const alg = ok ? detectAlg(decoded.header) : "unknown";
  const expiry = ok ? checkExpiry(decoded.payload) : null;
  const warnings = ok ? securityWarnings(decoded) : [];
  const registered = ok ? extractClaims(decoded.payload) : {};
  const custom = ok ? extractCustomClaims(decoded.payload) : {};
  const payloadObj = ok && decoded.payload && typeof decoded.payload === "object" ? decoded.payload as Record<string, unknown> : {};

  const batch = useMemo(() => {
    const jwts = parseBatchInput(batchText);
    if (!jwts.length) return { rows: [], decoded: [] };
    return batchDecode(jwts);
  }, [batchText]);

  const renderClaims = (claims: Record<string, unknown>) => {
    const entries = Object.entries(claims);
    if (!entries.length) return <p className="text-xs text-muted-foreground">— none —</p>;
    return (
      <ul className="text-xs space-y-1">
        {entries.map(([k, v]) => (
          <li key={k} className="flex gap-2">
            <span className="font-mono font-bold min-w-[60px]">{k}</span>
            <span className="font-mono text-muted-foreground break-all">
              {k === "exp" || k === "iat" || k === "nbf" ? (typeof v === "number" ? `${v} (${epochToIso(v)})` : String(v)) : String(v)}
            </span>
          </li>
        ))}
      </ul>
    );
  };

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

      {ok && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Algorithm</p><p className="text-sm font-mono font-bold">{alg}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Status</p><p className="text-sm font-mono font-bold">{expiry?.expired ? "expired" : expiry?.notYetValid ? "not yet valid" : "active"}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Issued at</p><p className="text-xs font-mono">{expiry?.issuedAt ?? "—"}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Expires</p><p className="text-xs font-mono">{expiry?.expiresAt ?? "—"}</p></CardContent></Card>
          </div>

          {warnings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-xs text-muted-foreground">Security warnings</Label>
                <ul className="space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className={`text-xs ${w.level === "danger" ? "text-destructive" : w.level === "warning" ? "text-yellow-700 dark:text-yellow-400" : "text-muted-foreground"}`}>
                      <Badge variant={w.level === "danger" ? "destructive" : "outline"} className="mr-2 uppercase">{w.level}</Badge>
                      {w.message}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Header</CardTitle>
                <CopyButton getText={() => prettyJson(decoded.header)} />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 rounded-b-lg font-mono whitespace-pre-wrap break-all">{prettyJson(decoded.header)}</pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Payload</CardTitle>
                <div className="flex gap-2">
                  <CopyButton getText={() => prettyJson(decoded.payload)} />
                  <DownloadButton getText={() => prettyJson(decoded.payload)} filename="jwt-payload.json" mime="application/json" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <pre className="text-xs overflow-x-auto p-3 bg-muted/40 font-mono whitespace-pre-wrap break-all">{prettyJson(decoded.payload)}</pre>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Registered claims</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">{renderClaims(registered)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Custom claims</CardTitle></CardHeader>
              <CardContent className="p-4 pt-0">{renderClaims(custom)}</CardContent>
            </Card>
          </div>

          {"exp" in payloadObj && typeof payloadObj.exp === "number" && expiry && (
            <Card><CardContent className="p-4 text-xs text-muted-foreground">
              <strong className="text-foreground">Expiry:</strong> {epochToIso(payloadObj.exp)}
              {expiry.secondsUntilExpiry !== undefined && (
                <span className="ml-2">
                  ({expiry.secondsUntilExpiry > 0 ? `expires in ${Math.floor(expiry.secondsUntilExpiry / 60)} min` : `expired ${Math.floor(-expiry.secondsUntilExpiry / 60)} min ago`})
                </span>
              )}
            </CardContent></Card>
          )}
        </>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Batch mode (one JWT per line)</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] font-mono"
            placeholder="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1MSJ9.sig"
            value={batchText}
            onChange={(e) => setBatchText(e.target.value)}
          />
          {batch.rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-2 text-xs">
                  <Badge variant="outline">{batch.rows.length} tokens</Badge>
                  <Badge variant="secondary">{batch.rows.filter((r) => r.ok).length} valid</Badge>
                  <Badge variant="destructive">{batch.rows.filter((r) => !r.ok).length} errors</Badge>
                </div>
                <DownloadButton getText={() => batchToCsv(batch.rows)} filename="jwt-batch.csv" mime="text/csv" />
              </div>
              <ul className="text-xs divide-y divide-border/50 rounded-md border border-border/50">
                {batch.rows.map((r) => (
                  <li key={r.index} className="p-2 flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">#{r.index + 1}</span>
                    {r.ok ? (
                      <>
                        <Badge variant="outline">{r.alg}</Badge>
                        <span className="flex-1 font-mono truncate">{r.sub ?? "—"}</span>
                        {r.expired && <Badge variant="destructive">expired</Badge>}
                      </>
                    ) : (
                      <span className="flex-1 text-destructive truncate">{r.error}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Registered claim reference</CardTitle></CardHeader>
        <CardContent className="p-4 pt-0">
          <ul className="text-xs space-y-1">
            {Object.entries(REGISTERED_CLAIMS).map(([k, v]) => (
              <li key={k} className="flex gap-2">
                <span className="font-mono font-bold min-w-[40px]">{k}</span>
                <span><strong>{v.name}.</strong> <span className="text-muted-foreground">{v.description}</span></span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground"><strong className="text-foreground">Privacy:</strong> all decoding runs locally in your browser.</p></CardContent></Card>
    </div>
  );
}
