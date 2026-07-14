"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  decodeJwt,
  decodeJwtSafe,
  getAlgorithm,
  verifySignature,
  lintJwt,
  computeTimeline,
  formatTimestamp,
  formatRelative,
  isExpired,
  REGISTERED_CLAIMS,
  prettyPrint,
  compareClaims,
  parseJwks,
  encodeJwt,
  buildShareUrl,
  extractTokenFromUrl,
  type JwtParts,
  type VerifyResult,
  type LintFinding,
  type TimelineInfo,
  type JwtAlgorithm,
  type ClaimDiff,
} from "./logic";
import { KeyRound, Clock, CheckCircle2, XCircle, AlertTriangle, Download, Share2, GitCompare } from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  info: "border-muted bg-muted/30 text-muted-foreground",
};

export default function JwtDecoder() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [jwksInput, setJwksInput] = useState("");
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [showEncoder, setShowEncoder] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [compareToken, setCompareToken] = useState("");

  // Load token from URL fragment on mount (extra #9)
  useEffect(() => {
    const urlToken = extractTokenFromUrl();
    if (urlToken) {
      setToken(urlToken);
      toast.success("Token loaded from URL");
    }
  }, []);

  // Live decode (no verification)
  const decoded = useMemo(() => (token.trim() ? decodeJwtSafe(token.trim()) : null), [token]);
  const algorithm = useMemo(() => (decoded?.isValid ? getAlgorithm(decoded) : undefined), [decoded]);
  const timeline = useMemo(() => (decoded?.isValid ? computeTimeline(decoded.payload) : null), [decoded]);
  const lintFindings = useMemo(() => (decoded?.isValid ? lintJwt(decoded, algorithm) : []), [decoded, algorithm]);
  const expired = useMemo(() => (decoded ? isExpired(decoded) : false), [decoded]);

  // Compare mode (extra #2)
  const compareDecoded = useMemo(() => (compareToken.trim() ? decodeJwtSafe(compareToken.trim()) : null), [compareToken]);
  const claimDiffs = useMemo(() => {
    if (!decoded?.isValid || !compareDecoded?.isValid) return null;
    return compareClaims(decoded.payload, compareDecoded.payload);
  }, [decoded, compareDecoded]);

  const handleVerify = useCallback(async () => {
    if (!decoded?.isValid || !algorithm) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      let jwks: JsonWebKey[] | undefined;
      if (jwksInput.trim()) {
        try {
          jwks = parseJwks(jwksInput);
        } catch (e) {
          toast.error(`JWKS parse error: ${(e as Error).message}`);
          setVerifying(false);
          return;
        }
      }
      const result = await verifySignature({
        token: token.trim(),
        parts: decoded,
        algorithm,
        secret: secret || undefined,
        jwks,
      });
      setVerifyResult(result);
    } catch (e) {
      setVerifyResult({ status: "error", message: (e as Error).message });
    } finally {
      setVerifying(false);
    }
  }, [decoded, algorithm, token, secret, jwksInput]);

  // Keyboard shortcuts (extra #10)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      switch (e.key.toLowerCase()) {
        case "v":
          if (decoded?.isValid) { e.preventDefault(); handleVerify(); }
          break;
        case "c":
          if (token) { e.preventDefault(); navigator.clipboard.writeText(token); toast.success("Token copied"); }
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleVerify, token, decoded]);

  const shareUrl = useCallback(() => {
    const url = buildShareUrl(token.trim());
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share URL copied (token in fragment, never sent to server)");
    });
  }, [token]);

  const exportJson = useCallback(() => {
    if (!decoded?.isValid) return;
    const json = JSON.stringify({ header: decoded.header, payload: decoded.payload }, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "jwt-decoded.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("JSON exported");
  }, [decoded]);

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
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(JSON.stringify(value));
              toast.success(`Copied ${key}`);
            }}
            className="text-[10px] text-primary hover:underline cursor-pointer ml-auto"
          >
            copy
          </button>
        </div>
        <code className="text-xs text-muted-foreground break-all">{JSON.stringify(value)}</code>
        {iso && (
          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> {iso} ({formatRelative(value as number)})
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Token input */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="jwt-input" className="text-xs text-muted-foreground">Paste JWT</Label>
            <div className="flex gap-2">
              <button type="button" onClick={shareUrl} disabled={!token.trim()}
                className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
                <Share2 className="h-3 w-3" /> Share
              </button>
              <button type="button" onClick={exportJson} disabled={!decoded?.isValid}
                className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
                <Download className="h-3 w-3" /> JSON
              </button>
              <button type="button" onClick={() => setShowEncoder(!showEncoder)}
                className={`text-xs hover:underline cursor-pointer ${showEncoder ? "text-primary" : "text-muted-foreground"}`}>
                Encoder
              </button>
              <button type="button" onClick={() => setShowCompare(!showCompare)}
                className={`text-xs hover:underline cursor-pointer ${showCompare ? "text-primary" : "text-muted-foreground"} inline-flex items-center gap-1`}>
                <GitCompare className="h-3 w-3" /> Compare
              </button>
            </div>
          </div>
          <Textarea
            id="jwt-input"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi..."
            value={token}
            onChange={(e) => { setToken(e.target.value); setVerifyResult(null); }}
            className="min-h-[80px] font-mono text-xs resize-y break-all"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={() => setToken("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c")}
            className="text-xs text-primary hover:underline cursor-pointer"
          >
            Load sample (HS256)
          </button>
          <p className="text-[10px] text-muted-foreground">
            Shortcuts: <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">V</kbd>=verify ·{" "}
            <kbd className="px-1 py-0.5 bg-muted rounded text-[9px]">C</kbd>=copy token
          </p>
        </CardContent>
      </Card>

      {decoded && !decoded.isValid && <ErrorBanner message={decoded.error ?? "Invalid JWT"} />}

      {decoded?.isValid && (
        <>
          {/* Summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Algorithm:</span>
                  <Badge variant="outline" className="font-mono">{algorithm ?? "—"}</Badge>
                </div>
                {decoded.payload.exp !== undefined && (
                  <Badge variant="outline" className={`gap-1 ${expired ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400" : timeline?.isFresh ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>
                    {expired ? <XCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                    {expired ? "Expired" : timeline?.isFresh ? "Expiring soon" : "Active"}
                  </Badge>
                )}
                {verifyResult && (
                  <Badge variant="outline" className={`gap-1 ${verifyResult.status === "valid" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : verifyResult.status === "alg-none" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                    {verifyResult.status === "valid" ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                    Sig: {verifyResult.status}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Lint findings */}
          {lintFindings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Security findings ({lintFindings.length})</Label>
                <div className="space-y-1.5">
                  {lintFindings.map((f, i) => (
                    <div key={i} className={`rounded-md border p-2 text-xs ${SEVERITY_STYLES[f.severity]}`}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <Badge variant="outline" className="text-[9px] uppercase bg-background/50">{f.severity}</Badge>
                        <code className="font-mono font-semibold">{f.code}</code>
                      </div>
                      <p>{f.message}</p>
                      <p className="text-[10px] opacity-80 mt-0.5"><strong>Fix:</strong> {f.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Timeline (extra #4) */}
          {timeline && (timeline.iat || timeline.nbf || timeline.exp) && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Token timeline</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  {timeline.iat && (
                    <div className="rounded-md border bg-muted/20 p-2">
                      <p className="text-[10px] text-muted-foreground">Issued (iat)</p>
                      <code className="font-mono text-[10px]">{formatTimestamp(timeline.iat)}</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(timeline.iat)}</p>
                    </div>
                  )}
                  {timeline.nbf && (
                    <div className="rounded-md border bg-muted/20 p-2">
                      <p className="text-[10px] text-muted-foreground">Not before (nbf)</p>
                      <code className="font-mono text-[10px]">{formatTimestamp(timeline.nbf)}</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{formatRelative(timeline.nbf)}</p>
                    </div>
                  )}
                  {timeline.exp && (
                    <div className={`rounded-md border p-2 ${timeline.isExpired ? "border-red-500/30 bg-red-500/10" : timeline.isFresh ? "border-amber-500/30 bg-amber-500/10" : "border-emerald-500/30 bg-emerald-500/10"}`}>
                      <p className="text-[10px] text-muted-foreground">Expires (exp)</p>
                      <code className="font-mono text-[10px]">{formatTimestamp(timeline.exp)}</code>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {timeline.isExpired ? `${Math.abs(timeline.secondsToExpiry!)}s ago` : `in ${timeline.secondsToExpiry}s`}
                      </p>
                    </div>
                  )}
                  <div className="rounded-md border bg-primary/5 p-2">
                    <p className="text-[10px] text-muted-foreground">Now</p>
                    <code className="font-mono text-[10px]">{formatTimestamp(timeline.now)}</code>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Verify panel */}
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Verify signature</Label>
              {algorithm === "none" ? (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Algorithm is "none" — token is unsigned and cannot be verified.
                </div>
              ) : algorithm?.startsWith("HS") ? (
                <div className="space-y-2">
                  <Label htmlFor="jwt-secret" className="text-xs text-muted-foreground">HMAC secret</Label>
                  <Input
                    id="jwt-secret"
                    type="password"
                    placeholder="your-256-bit-secret"
                    value={secret}
                    onChange={(e) => setSecret(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={!secret || verifying}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? "Verifying…" : "Verify signature"}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="jwt-jwks" className="text-xs text-muted-foreground">Public key (JWK or JWKS JSON)</Label>
                  <Textarea
                    id="jwt-jwks"
                    placeholder='{"kty":"RSA","kid":"k1","n":"...","e":"AQAB"}'
                    value={jwksInput}
                    onChange={(e) => setJwksInput(e.target.value)}
                    className="min-h-[60px] font-mono text-xs resize-y"
                    spellCheck={false}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Paste a single JWK, a JWKS ({"{\"keys\":[...]}"}) array, or leave empty to decode only.
                    Auto-selects by <code>kid</code> header if present.
                  </p>
                  <button
                    type="button"
                    onClick={handleVerify}
                    disabled={!jwksInput.trim() || verifying}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50"
                  >
                    {verifying ? "Verifying…" : "Verify signature"}
                  </button>
                </div>
              )}
              {verifyResult && (
                <div className={`rounded-md border p-3 text-xs ${verifyResult.status === "valid" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"}`}>
                  {verifyResult.message}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Header */}
          <Card>
            <CardContent className="p-4 space-y-2">
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
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Payload (claims)</Label>
                <CopyButton getText={() => prettyPrint(decoded.payload)} label="Copy JSON" size="sm" />
              </div>
              <pre className="overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs mb-2">
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
                {decoded.signature || "(empty — alg:none)"}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {/* Compare mode (extra #2) */}
      {showCompare && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <Label className="text-sm font-semibold">Compare with another JWT</Label>
            <Textarea
              placeholder="Paste second JWT to compare claims"
              value={compareToken}
              onChange={(e) => setCompareToken(e.target.value)}
              className="min-h-[60px] font-mono text-xs resize-y"
              spellCheck={false}
            />
            {claimDiffs && (
              <div className="space-y-1">
                {claimDiffs.map((d, i) => (
                  <div key={i} className={`grid grid-cols-[100px_1fr_1fr] gap-2 items-center text-xs rounded-md border p-2 ${d.same ? "bg-emerald-500/5" : d.onlyIn !== "both" ? "bg-blue-500/5" : "bg-red-500/5"}`}>
                    <code className="font-semibold">{d.key}</code>
                    <code className={`break-all ${d.same ? "text-muted-foreground" : ""}`}>{d.leftValue !== undefined ? JSON.stringify(d.leftValue) : "—"}</code>
                    <code className={`break-all ${d.same ? "text-muted-foreground" : ""}`}>{d.rightValue !== undefined ? JSON.stringify(d.rightValue) : "—"}</code>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Encoder (blueprint feature) */}
      {showEncoder && <EncoderPanel onEncode={(t) => { setToken(t); setShowEncoder(false); }} />}

      {!token.trim() && (
        <EmptyState
          title="Paste a JWT to decode"
          hint="Tokens are decoded locally in your browser. Nothing is sent to any server. Only paste tokens you own or are authorized to inspect."
          icon={<KeyRound className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> JWT decoding and verification is done entirely in your browser via WebCrypto. Your token never leaves your device. Share URLs encode the token in the URL fragment (#) which is NOT sent to servers. Never include secrets or private keys in shared URLs.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Encoder panel (blueprint feature) =====

function EncoderPanel({ onEncode }: { onEncode: (token: string) => void }) {
  const [payloadJson, setPayloadJson] = useState(JSON.stringify({ sub: "1234567890", name: "John Doe", iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 }, null, 2));
  const [algorithm, setAlgorithm] = useState<JwtAlgorithm>("HS256");
  const [secret, setSecret] = useState("your-256-bit-secret");
  const [error, setError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);

  const handleEncode = async () => {
    setError(null);
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(payloadJson);
    } catch (e) {
      setError(`Invalid payload JSON: ${(e as Error).message}`);
      return;
    }
    setEncoding(true);
    try {
      const result = await encodeJwt({
        header: { typ: "JWT" },
        payload,
        algorithm,
        secret: algorithm.startsWith("HS") ? secret : undefined,
      });
      if (result.ok && result.token) {
        onEncode(result.token);
        toast.success("JWT encoded and loaded");
      } else {
        setError(result.error ?? "Encoding failed");
      }
    } finally {
      setEncoding(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Label className="text-sm font-semibold">Encode a new JWT</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="enc-alg" className="text-xs text-muted-foreground">Algorithm</Label>
            <select
              id="enc-alg"
              value={algorithm}
              onChange={(e) => setAlgorithm(e.target.value as JwtAlgorithm)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm cursor-pointer"
            >
              <option value="HS256">HS256</option>
              <option value="HS384">HS384</option>
              <option value="HS512">HS512</option>
              <option value="none">none (unsigned — not for auth)</option>
            </select>
          </div>
          {algorithm.startsWith("HS") && (
            <div className="space-y-1.5">
              <Label htmlFor="enc-secret" className="text-xs text-muted-foreground">Secret</Label>
              <Input
                id="enc-secret"
                type="password"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="enc-payload" className="text-xs text-muted-foreground">Payload (JSON)</Label>
          <Textarea
            id="enc-payload"
            value={payloadJson}
            onChange={(e) => setPayloadJson(e.target.value)}
            className="min-h-[100px] font-mono text-xs resize-y"
            spellCheck={false}
          />
        </div>
        {error && <ErrorBanner message={error} />}
        <button
          type="button"
          onClick={handleEncode}
          disabled={encoding}
          className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50"
        >
          {encoding ? "Encoding…" : "Encode & load"}
        </button>
        <p className="text-[10px] text-muted-foreground">
          Note: RS/PS/ES/EdDSA signing requires a private key — not yet supported. Use HS256/384/512 or alg:none.
        </p>
      </CardContent>
    </Card>
  );
}
