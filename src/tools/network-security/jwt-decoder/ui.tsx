"use client";

import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { decodeJwt, formatTimestamp, isExpired, getAlgorithm, REGISTERED_CLAIMS, prettyPrint } from "./logic";
import { KeyRound, Clock, CheckCircle2, XCircle } from "lucide-react";

export default function JwtDecoder() {
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      return decodeJwt(token);
    } catch (e) {
      return null;
    }
  }, [token]);

  const errorMsg = useMemo(() => {
    if (!token.trim()) return null;
    try {
      decodeJwt(token);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [token]);

  const expired = useMemo(() => (decoded ? isExpired(decoded) : false), [decoded]);
  const alg = useMemo(() => (decoded ? getAlgorithm(decoded) : undefined), [decoded]);

  const loadSample = useCallback(() => {
    setToken(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE5OTk5OTk5OTl9.qH4Z9qLpVb3Vw1Xy1N7gX3p1t5Xy1N7gX3p1t5Xy1N7g",
    );
  }, []);

  const renderClaimRow = (key: string, value: unknown) => {
    const isRegistered = REGISTERED_CLAIMS.has(key);
    const isTimestamp = ["exp", "iat", "nbf", "auth_time"].includes(key) && typeof value === "number";
    const iso = isTimestamp ? formatTimestamp(value as number) : null;
    return (
      <div
        key={key}
        className={`flex flex-col gap-1 rounded-md border p-2 ${
          isRegistered ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20"
        }`}
      >
        <div className="flex items-center gap-2">
          <code className="text-xs font-semibold text-foreground">{key}</code>
          {isRegistered && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">registered</Badge>
          )}
        </div>
        <code className="text-xs text-muted-foreground break-all">{JSON.stringify(value)}</code>
        {iso && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {iso}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="jwt-input" className="text-xs text-muted-foreground">
              Paste JWT
            </Label>
            <button
              type="button"
              onClick={loadSample}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Load sample
            </button>
          </div>
          <Textarea
            id="jwt-input"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi..."
            value={token}
            onChange={(e) => {
              setToken(e.target.value);
              setError(null);
            }}
            className="min-h-[80px] font-mono text-xs resize-y break-all"
            aria-label="JWT input"
          />
        </CardContent>
      </Card>

      {errorMsg && <ErrorBanner message={errorMsg} />}

      {decoded && (
        <>
          {/* Summary card */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Algorithm:</span>
                  <Badge variant="outline" className="font-mono">{alg ?? "—"}</Badge>
                </div>
                {decoded.payload.exp !== undefined && (
                  <Badge
                    variant="outline"
                    className={`gap-1 ${
                      expired
                        ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {expired ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {expired ? "Expired" : "Active"}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Header */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Header</Label>
                <CopyButton getText={() => prettyPrint(decoded.header)} label="Copy JSON" size="sm" />
              </div>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs">
                {prettyPrint(decoded.header)}
              </pre>
            </CardContent>
          </Card>

          {/* Payload */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payload (claims)</Label>
                <CopyButton getText={() => prettyPrint(decoded.payload)} label="Copy JSON" size="sm" />
              </div>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs mb-3">
                {prettyPrint(decoded.payload)}
              </pre>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {Object.entries(decoded.payload).map(([k, v]) => renderClaimRow(k, v))}
              </div>
            </CardContent>
          </Card>

          {/* Signature */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Signature (base64url)</Label>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
                {decoded.signature}
              </pre>
              <p className="text-[10px] text-muted-foreground">
                Signature verification requires the issuer's secret (HS256) or public key (RS256/ES256).
                This tool only decodes — it does not verify.
              </p>
            </CardContent>
          </Card>
        </>
      )}

      {!token.trim() && !error && (
        <EmptyState
          title="Paste a JWT to decode"
          hint="Tokens are decoded locally in your browser. Nothing is sent to any server."
          icon={<KeyRound className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> JWT decoding is a
            local base64url operation. Your token never leaves your browser. Only paste
            tokens you own or are authorized to inspect.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
