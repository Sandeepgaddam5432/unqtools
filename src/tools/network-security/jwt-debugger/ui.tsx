"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  decodeJwt,
  verifyJwt,
  signJwt,
  lintSecret,
  describeClaims,
  encodeShareUrl,
  decodeShareUrl,
  prettyJson,
  base64UrlDecode,
  bytesToUtf8,
  SAMPLE_TOKENS,
  type JwtAlg,
  type Severity,
} from "./logic";
import { KeyRound, ShieldCheck, ShieldX, ShieldAlert, AlertTriangle, Link2, ClipboardPaste, Wand2 } from "lucide-react";
import { toast } from "sonner";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  info: "border-muted bg-muted/30 text-muted-foreground",
};

export default function JwtDebugger() {
  const [token, setToken] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyAlg, setVerifyAlg] = useState<JwtAlg>("HS256");
  const [verifyResult, setVerifyResult] = useState<{ verified: boolean; reason?: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Encoder pane state
  const [encHeader, setEncHeader] = useState('{"typ":"JWT"}');
  const [encPayload, setEncPayload] = useState('{"sub":"1234567890","name":"Jane Doe","iat":1516239022,"exp":9999999999}');
  const [encSecret, setEncSecret] = useState("");
  const [encAlg, setEncAlg] = useState<JwtAlg>("HS256");
  const [encOutput, setEncOutput] = useState("");

  // hydrate from URL fragment once
  useEffect(() => {
    const fromHash = decodeShareUrl(window.location.hash);
    if (fromHash) {
      setToken(fromHash);
      toast.info("Loaded token from URL fragment");
    }
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const decoded = useMemo(() => (token.trim() ? decodeJwt(token) : null), [token]);
  const secretLint = useMemo(() => (secret ? lintSecret(secret) : []), [secret]);
  const claims = useMemo(() => (decoded?.payload ? describeClaims(decoded.payload, now) : []), [decoded, now]);

  const handleVerify = useCallback(async () => {
    if (!token.trim()) return;
    setVerifying(true);
    try {
      const r = await verifyJwt(token, secret, verifyAlg);
      setVerifyResult(r);
    } finally {
      setVerifying(false);
    }
  }, [token, secret, verifyAlg]);

  const handlePaste = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      setToken(t.trim());
      toast.success("Pasted token from clipboard");
    } catch {
      toast.error("Could not read clipboard");
    }
  }, []);

  const handleShare = useCallback(() => {
    if (!token.trim()) return;
    const url = `${window.location.origin}${window.location.pathname}${encodeShareUrl(token)}`;
    navigator.clipboard.writeText(url);
    toast.success("Shareable URL copied (token only — secret never included)");
  }, [token]);

  const handleSign = useCallback(async () => {
    try {
      let header: Record<string, unknown> = {};
      let payload: Record<string, unknown> = {};
      try {
        header = JSON.parse(encHeader);
      } catch (e) {
        toast.error(`Header JSON: ${(e as Error).message}`);
        return;
      }
      try {
        payload = JSON.parse(encPayload);
      } catch (e) {
        toast.error(`Payload JSON: ${(e as Error).message}`);
        return;
      }
      if (!encSecret) {
        toast.error("Enter a secret to sign");
        return;
      }
      const out = await signJwt(header, payload, encSecret, encAlg);
      setEncOutput(out);
      toast.success(`Signed with ${encAlg}`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [encHeader, encPayload, encSecret, encAlg]);

  const tryDecode = useCallback((b64: string): string => {
    try {
      return bytesToUtf8(base64UrlDecode(b64));
    } catch {
      return "(undecodable)";
    }
  }, []);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label htmlFor="jwt-input" className="text-xs text-muted-foreground">Encoded JWT</Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={handlePaste}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border bg-background hover:bg-muted cursor-pointer">
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
              <button type="button" onClick={() => setToken(SAMPLE_TOKENS.valid)} className="text-[11px] text-primary hover:underline cursor-pointer">HS256 sample</button>
              <button type="button" onClick={() => setToken(SAMPLE_TOKENS.algNone)} className="text-[11px] text-amber-600 hover:underline cursor-pointer">alg:none sample</button>
              <button type="button" onClick={() => setToken(SAMPLE_TOKENS.expired)} className="text-[11px] text-red-600 hover:underline cursor-pointer">Expired sample</button>
            </div>
          </div>
          <Textarea id="jwt-input" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIi..." value={token}
            onChange={(e) => { setToken(e.target.value); setVerifyResult(null); }}
            className="min-h-[80px] font-mono text-xs resize-y break-all" aria-label="JWT input" spellCheck={false} />
          <div className="flex flex-wrap gap-2 pt-1">
            <button type="button" onClick={handleShare} disabled={!token.trim()}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer disabled:opacity-50">
              <Link2 className="h-3 w-3" /> Copy share URL
            </button>
          </div>
        </CardContent>
      </Card>

      {decoded && !decoded.isValidFormat && <ErrorBanner message={decoded.error ?? "Invalid JWT"} />}

      {decoded?.isValidFormat && (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold">Decoded parts</Label>
              <div className="space-y-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">HEADER</Badge>
                    {decoded.header.alg && <Badge variant="outline" className="text-[10px] font-mono">{decoded.header.alg}</Badge>}
                    <CopyButton getText={() => decoded.parts.header} label="Copy" size="sm" />
                  </div>
                  <pre className="text-[11px] font-mono bg-muted/40 rounded-md p-2 overflow-x-auto">{prettyJson(decoded.header)}</pre>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">PAYLOAD</Badge>
                    <CopyButton getText={() => decoded.parts.payload} label="Copy" size="sm" />
                  </div>
                  <pre className="text-[11px] font-mono bg-muted/40 rounded-md p-2 overflow-x-auto">{prettyJson(decoded.payload)}</pre>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">SIGNATURE</Badge>
                    <CopyButton getText={() => decoded.signature} label="Copy" size="sm" />
                  </div>
                  <code className="text-[11px] font-mono break-all">{decoded.signature || "(empty — unsigned)"}</code>
                </div>
              </div>
            </CardContent>
          </Card>

          {claims.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold">Claims</Label>
                <div className="space-y-1">
                  {claims.map((c) => (
                    <div key={c.claim} className="grid grid-cols-[100px_1fr] gap-2 text-xs py-1 border-b border-border/40 last:border-0">
                      <code className="font-mono text-foreground font-semibold">{c.claim}</code>
                      <div className="min-w-0">
                        <div className="font-mono text-muted-foreground break-all">{c.value}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{c.description}</div>
                        {c.humanTime && <div className="text-[10px] text-blue-600 dark:text-blue-400 mt-0.5">{c.humanTime}</div>}
                        {c.countdown && <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">{c.claim === "exp" && c.value < String(Math.floor(now / 1000)) ? "Expired " : ""}{c.countdown}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {decoded.lint.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Security lint</Label>
                <div className="space-y-1.5">
                  {decoded.lint.map((l, i) => (
                    <div key={i} className={`rounded-md border p-2 text-xs ${SEVERITY_STYLES[l.severity]}`}>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] uppercase bg-background/50">{l.severity}</Badge>
                        <code className="font-mono text-[10px]">{l.code}</code>
                      </div>
                      <p>{l.message}</p>
                      <p className="text-[10px] opacity-80 mt-0.5"><strong>Fix:</strong> {l.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2"><KeyRound className="h-4 w-4 text-primary" /> Verify signature (HS256/384/512)</Label>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
            <select value={verifyAlg} onChange={(e) => setVerifyAlg(e.target.value as JwtAlg)}
              className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="HS256">HS256</option>
              <option value="HS384">HS384</option>
              <option value="HS512">HS512</option>
            </select>
            <Input type="text" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="HMAC secret" className="font-mono text-xs" />
          </div>
          {secretLint.length > 0 && (
            <div className="space-y-1">
              {secretLint.map((l, i) => (
                <div key={i} className={`rounded-md border p-1.5 text-[11px] ${SEVERITY_STYLES[l.severity]}`}>
                  <strong>{l.code}:</strong> {l.message}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={handleVerify} disabled={!token.trim() || verifying}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer disabled:opacity-50">
              {verifying ? "Verifying…" : "Verify signature"}
            </button>
            {verifyResult && (
              <div className={`flex items-center gap-1.5 text-xs font-medium ${verifyResult.verified ? "text-emerald-600" : "text-red-600"}`}>
                {verifyResult.verified ? <ShieldCheck className="h-4 w-4" /> : <ShieldX className="h-4 w-4" />}
                {verifyResult.verified ? "Signature valid" : "Invalid"}
              </div>
            )}
          </div>
          {verifyResult && !verifyResult.verified && verifyResult.reason && (
            <p className="text-[11px] text-red-600 dark:text-red-400">{verifyResult.reason}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-3">
          <Label className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Encoder / generator</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Header JSON</Label>
              <Textarea value={encHeader} onChange={(e) => setEncHeader(e.target.value)} className="min-h-[60px] font-mono text-xs" spellCheck={false} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Payload JSON</Label>
              <Textarea value={encPayload} onChange={(e) => setEncPayload(e.target.value)} className="min-h-[60px] font-mono text-xs" spellCheck={false} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2">
            <select value={encAlg} onChange={(e) => setEncAlg(e.target.value as JwtAlg)} className="rounded-md border bg-background px-2 py-1 text-xs">
              <option value="HS256">HS256</option>
              <option value="HS384">HS384</option>
              <option value="HS512">HS512</option>
            </select>
            <Input type="text" value={encSecret} onChange={(e) => setEncSecret(e.target.value)} placeholder="Secret to sign with" className="font-mono text-xs" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button type="button" onClick={handleSign} className="px-3 py-1.5 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">Sign &amp; generate</button>
            {encOutput && <CopyButton getText={() => encOutput} label="Copy token" />}
            {encOutput && <button type="button" onClick={() => setToken(encOutput)} className="text-[11px] text-primary hover:underline cursor-pointer">Load into decoder</button>}
          </div>
          {encOutput && (
            <pre className="text-[11px] font-mono bg-muted/40 rounded-md p-2 overflow-x-auto break-all whitespace-pre-wrap">{encOutput}</pre>
          )}
        </CardContent>
      </Card>

      {!token.trim() && (
        <EmptyState title="Paste a JWT to decode, verify and lint" hint="All decoding and HMAC verification runs locally via WebCrypto. No token or secret ever leaves your browser." icon={<KeyRound className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Tokens are credentials.</strong> Decode, verification, and signing all run locally via WebCrypto — your token and secret never leave this browser. Share URLs encode the token (no secret) only in the URL fragment.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
