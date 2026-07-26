"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import {
  analyzeCsp,
  scoreLabel,
  suggestStrictCsp,
  buildCsp,
  cspToNginx,
  cspToApache,
  cspToMetaTag,
  generateNonce,
  hashInlineScript,
  encodeToFragment,
  decodeFromFragment,
  parseReportTo,
  DIRECTIVE_DOCS,
  type Severity,
} from "./logic";
import { ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Wand2, FileCode2, Hash, Link2, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";

const SEVERITY_STYLES: Record<Severity, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  info: "border-muted bg-muted/30 text-muted-foreground",
};

const SCORE_STYLES: Record<string, string> = {
  Excellent: "text-emerald-600 dark:text-emerald-400",
  Good: "text-emerald-600 dark:text-emerald-400",
  Fair: "text-amber-600 dark:text-amber-400",
  Weak: "text-orange-600 dark:text-orange-400",
  Critical: "text-red-600 dark:text-red-400",
};

export default function CspGenerator() {
  const [input, setInput] = useState("");
  const [reportOnly, setReportOnly] = useState(false);
  const [inlineScript, setInlineScript] = useState("");
  const [hashResult, setHashResult] = useState("");
  const [reportToJson, setReportToJson] = useState(
    '[{"group":"csp-endpoint","max_age":10886400,"endpoints":[{"url":"https://reports.example.com/csp"}]}]',
  );
  const [urlHash, setUrlHash] = useState("");

  const analysis = useMemo(() => (input.trim() ? analyzeCsp(input) : null), [input]);
  const reportToCheck = useMemo(() => parseReportTo(reportToJson), [reportToJson]);

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0, info: 0 };
    analysis?.findings.forEach((f) => { c[f.severity]++; });
    return c;
  }, [analysis]);

  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const t = await navigator.clipboard.readText();
      setInput(t);
      toast.success("Pasted CSP from clipboard");
    } catch {
      toast.error("Could not read clipboard");
    }
  }, []);

  const handleShareUrl = useCallback(() => {
    const frag = encodeToFragment(input, reportOnly);
    const url = `${window.location.origin}${window.location.pathname}${frag}`;
    navigator.clipboard.writeText(url);
    toast.success("Shareable URL copied (CSP config only — no secrets)");
  }, [input, reportOnly]);

  const handleHash = useCallback(async () => {
    if (!inlineScript.trim()) {
      toast.error("Paste an inline script first");
      return;
    }
    const h = await hashInlineScript(inlineScript);
    setHashResult(h);
    toast.success("SHA-256 hash computed");
  }, [inlineScript]);

  const handleLoadFromHash = useCallback(() => {
    if (!urlHash.trim()) return;
    try {
      const frag = /#csp=/.test(urlHash) ? urlHash : `#csp=${urlHash}`;
      const r = decodeFromFragment(frag);
      if (r) {
        setInput(r.csp);
        setReportOnly(r.reportOnly);
        toast.success("Loaded CSP from URL fragment");
      } else {
        toast.error("No CSP config found in URL");
      }
    } catch {
      toast.error("Invalid share URL");
    }
  }, [urlHash]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <Label htmlFor="csp-input" className="text-xs text-muted-foreground">
              Content-Security-Policy header value
            </Label>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={handlePasteFromClipboard}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] border bg-background hover:bg-muted cursor-pointer">
                <ClipboardPaste className="h-3 w-3" /> Paste
              </button>
              <button type="button" onClick={() => setInput(suggestStrictCsp("spa").csp)}
                className="text-[11px] text-primary hover:underline cursor-pointer">
                Load sample (strict SPA)
              </button>
              <button type="button" onClick={() => setInput("default-src 'self'; script-src 'self' 'unsafe-inline' cdn.example.com http:; img-src *")}
                className="text-[11px] text-amber-600 hover:underline cursor-pointer">
                Load sample (weak)
              </button>
            </div>
          </div>
          <Textarea
            id="csp-input"
            placeholder="default-src 'self'; script-src 'self' 'nonce-XYZ' 'strict-dynamic'; object-src 'none'; base-uri 'none'"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="min-h-[90px] font-mono text-xs resize-y"
            aria-label="CSP header input"
            spellCheck={false}
          />
          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input type="checkbox" checked={reportOnly} onChange={(e) => setReportOnly(e.target.checked)}
                className="rounded" />
              Report-Only mode
            </label>
            <button type="button" onClick={handleShareUrl} disabled={!input.trim()}
              className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline cursor-pointer disabled:opacity-50">
              <Link2 className="h-3 w-3" /> Copy share URL
            </button>
          </div>
        </CardContent>
      </Card>

      {analysis && !analysis.isValid && <ErrorBanner message={analysis.error ?? "Invalid CSP"} />}

      {analysis?.isValid && (
        <>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-6 flex-wrap">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Score</p>
                  <p className={`text-5xl font-bold ${SCORE_STYLES[scoreLabel(analysis.score)]}`}>{analysis.score}</p>
                  <p className={`text-sm font-medium mt-1 ${SCORE_STYLES[scoreLabel(analysis.score)]}`}>{scoreLabel(analysis.score)}</p>
                </div>
                <div className="flex-1 space-y-1.5 min-w-[200px]">
                  <div className="flex items-center gap-2 text-sm">
                    {analysis.score >= 75 ? <ShieldCheck className="h-4 w-4 text-emerald-600" /> : analysis.score >= 50 ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : <ShieldX className="h-4 w-4 text-red-600" />}
                    <span>{analysis.findings.length} {analysis.findings.length === 1 ? "finding" : "findings"} · {analysis.gadgets.length} {analysis.gadgets.length === 1 ? "gadget" : "gadgets"}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1 text-[10px]">
                    <Badge variant="outline" className={`${SEVERITY_STYLES.high} justify-center`}>{counts.high} high</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.medium} justify-center`}>{counts.medium} med</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.low} justify-center`}>{counts.low} low</Badge>
                    <Badge variant="outline" className={`${SEVERITY_STYLES.info} justify-center`}>{counts.info} info</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {analysis.findings.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Live XSS-bypass findings</Label>
                <div className="space-y-2">
                  {analysis.findings.map((f, i) => (
                    <div key={i} className={`rounded-md border p-3 ${SEVERITY_STYLES[f.severity]}`}>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="outline" className="text-[10px] uppercase bg-background/50">{f.severity}</Badge>
                        <code className="text-xs font-mono font-semibold">{f.directive}</code>
                      </div>
                      <p className="text-xs mb-2">{f.message}</p>
                      <p className="text-[11px] opacity-80"><strong>Fix:</strong> {f.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {analysis.gadgets.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Bypass gadgets ({analysis.gadgets.length})
                </Label>
                <div className="space-y-1.5">
                  {analysis.gadgets.map((g, i) => (
                    <div key={i} className={`rounded-md border p-2 text-xs ${SEVERITY_STYLES[g.severity]}`}>
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[9px] uppercase bg-background/50">{g.severity}</Badge>
                        <Badge variant="outline" className="text-[9px] uppercase bg-background/50">{g.type}</Badge>
                        <code className="font-mono">{g.source}</code>
                      </div>
                      <p>{g.message}</p>
                      <p className="text-[10px] opacity-80 mt-0.5"><strong>Fix:</strong> {g.recommendation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <Label className="text-sm font-semibold flex items-center gap-2"><FileCode2 className="h-4 w-4 text-primary" /> Export formats</Label>
              <div className="flex flex-wrap gap-2">
                <CopyButton getText={() => input} label="Copy header" />
                <CopyButton getText={() => cspToNginx(input, reportOnly)} label="Nginx" />
                <CopyButton getText={() => cspToApache(input, reportOnly)} label="Apache" />
                <CopyButton getText={() => cspToMetaTag(input, reportOnly)} label="Meta tag" />
                <button type="button" onClick={() => { const n = generateNonce(16); navigator.clipboard.writeText(n); toast.success(`Nonce copied: ${n.slice(0, 8)}…`); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-primary text-primary-foreground hover:opacity-90 cursor-pointer">
                  <Wand2 className="h-3 w-3" /> Generate nonce
                </button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4 text-primary" /> Strict-CSP presets</Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(["spa", "ssr", "static", "api"] as const).map((t) => {
              const p = suggestStrictCsp(t);
              return (
                <button key={t} type="button" onClick={() => setInput(p.csp)}
                  className="text-left rounded-md border bg-muted/20 p-2.5 hover:bg-muted/40 transition-colors cursor-pointer">
                  <p className="text-xs font-semibold">{p.name}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-2">{p.description}</p>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2"><Hash className="h-4 w-4 text-primary" /> Inline-script SHA-256 hasher</Label>
          <Textarea value={inlineScript} onChange={(e) => setInlineScript(e.target.value)} placeholder="console.log('hello');" className="min-h-[60px] font-mono text-xs" spellCheck={false} />
          <div className="flex gap-2 items-center flex-wrap">
            <button type="button" onClick={handleHash} className="px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer">Compute SHA-256</button>
            {hashResult && (
              <code className="text-[11px] font-mono text-muted-foreground break-all flex-1 min-w-[200px]">{hashResult}</code>
            )}
            {hashResult && <CopyButton getText={() => hashResult} label="Copy hash" />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold">Report-To header (JSON)</Label>
          <Textarea value={reportToJson} onChange={(e) => setReportToJson(e.target.value)} className="min-h-[60px] font-mono text-xs" spellCheck={false} />
          <p className={`text-[11px] ${reportToCheck.ok ? "text-emerald-600" : "text-red-600"}`}>
            {reportToCheck.ok ? "Valid Report-To header. Use group name in report-to directive." : `Invalid: ${reportToCheck.error}`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <Label className="text-sm font-semibold flex items-center gap-2"><Link2 className="h-4 w-4 text-primary" /> Load CSP from share URL</Label>
          <Input value={urlHash} onChange={(e) => setUrlHash(e.target.value)} placeholder="https://unqtools.pages.dev/tools/csp-generator#csp=..." className="font-mono text-xs" />
          <button type="button" onClick={handleLoadFromHash} disabled={!urlHash.trim()} className="px-2.5 py-1 rounded-md text-xs font-medium border bg-background hover:bg-muted cursor-pointer disabled:opacity-50">Load</button>
        </CardContent>
      </Card>

      {!input.trim() && (
        <EmptyState title="Build or paste a CSP header to begin" hint="Live XSS-bypass evaluation runs as you type. Try a strict-CSP preset, or paste your existing header to audit it." icon={<ShieldCheck className="h-8 w-8" />} />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> CSP building, evaluation, nonce generation and hashing all run in your browser. Share URLs encode the policy config in the URL fragment — no secrets, no network calls. A CSP header is inherently public information.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
