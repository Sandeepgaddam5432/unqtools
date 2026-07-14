"use client";

import React, { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CopyButton, ErrorBanner, EmptyState } from "../../_shared";
import { toast } from "sonner";
import {
  parseUrl, getEffectivePort, isHttps,
  normalizeUrl, DEFAULT_NORMALIZE,
  checkUrlSafety, detectRedirectHints, findEncodedChars,
  getSchemeInfo, parseMailto, parseTel,
  buildShareUrl, extractUrlFromFragment,
  loadUrlHistory, saveUrlToHistory, clearUrlHistory,
} from "./logic";
import { Link2, ShieldCheck, ShieldAlert, AlertTriangle, Share2, History, Trash2, Wand2 } from "lucide-react";

export default function UrlParser() {
  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState(() => loadUrlHistory());

  // Load URL from fragment on mount (extra #9)
  useEffect(() => {
    const urlToken = extractUrlFromFragment();
    if (urlToken) {
      setInput(urlToken);
      toast.success("URL loaded from share link");
    }
  }, []);

  const parsed = useMemo(() => (input.trim() ? parseUrl(input) : null), [input]);

  // New v8.1 features
  const safetyFindings = useMemo(() => (parsed?.isValid ? checkUrlSafety(parsed) : []), [parsed]);
  const redirectHints = useMemo(() => (parsed?.isValid ? detectRedirectHints(parsed) : []), [parsed]);
  const encodedChars = useMemo(() => (parsed?.isValid ? findEncodedChars(parsed) : []), [parsed]);
  const schemeInfo = useMemo(() => (parsed?.isValid ? getSchemeInfo(parsed.protocol) : undefined), [parsed]);
  const mailtoParsed = useMemo(() => (input.trim().toLowerCase().startsWith("mailto:") ? parseMailto(input.trim()) : null), [input]);
  const telParsed = useMemo(() => (input.trim().toLowerCase().startsWith("tel:") ? parseTel(input.trim()) : null), [input]);
  const normalizedUrl = useMemo(() => (parsed?.isValid ? normalizeUrl(input.trim()) : ""), [parsed, input]);

  const handleSave = () => {
    if (!parsed?.isValid) return;
    const updated = saveUrlToHistory(input.trim());
    setHistory(updated);
    toast.success("Saved to history");
  };

  const handleShare = () => {
    const url = buildShareUrl(input.trim());
    navigator.clipboard.writeText(url).then(() => {
      toast.success("Share URL copied (input in fragment, never sent to server)");
    });
  };

  const handleClearHist = () => {
    clearUrlHistory();
    setHistory([]);
    toast.success("History cleared");
  };

  const rows = useMemo(() => {
    if (!parsed?.isValid) return [];
    const port = getEffectivePort(parsed);
    return [
      { label: "Protocol", value: parsed.protocol, hint: "" },
      { label: "Username", value: parsed.username || "—", hint: "" },
      { label: "Password", value: parsed.password ? "•".repeat(parsed.password.length) : "—", hint: "" },
      { label: "Hostname", value: parsed.hostname, hint: "" },
      { label: "Port", value: parsed.port || `(${port ?? "default"})`, hint: "" },
      { label: "Host", value: parsed.host, hint: "hostname + port" },
      { label: "Origin", value: parsed.origin, hint: "scheme + host" },
      { label: "Pathname", value: parsed.pathname, hint: "" },
      { label: "Search", value: parsed.search || "—", hint: "query string" },
      { label: "Hash", value: parsed.hash || "—", hint: "fragment" },
    ];
  }, [parsed]);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="url-input" className="text-xs text-muted-foreground">
            URL to parse
          </Label>
          <Input
            id="url-input"
            placeholder="https://user:pass@example.com:8443/path?q=1#hash"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="font-mono text-sm"
            aria-label="URL input"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setInput("https://user:pass@example.com:8443/path/to/page?a=1&b=two&tag=x&tag=y#section")}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              Load sample
            </button>
            <button type="button" onClick={handleSave} disabled={!parsed?.isValid}
              className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
              <History className="h-3 w-3" /> Save
            </button>
            <button type="button" onClick={handleShare} disabled={!input.trim()}
              className="text-xs text-primary hover:underline cursor-pointer disabled:opacity-50 inline-flex items-center gap-1">
              <Share2 className="h-3 w-3" /> Share
            </button>
            <button type="button" onClick={() => setShowHistory(!showHistory)}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer">
              History ({history.length})
            </button>
          </div>
        </CardContent>
      </Card>

      {parsed && !parsed.isValid && <ErrorBanner message={parsed.error ?? "Invalid URL"} />}

      {parsed?.isValid && (
        <>
          {/* Security summary */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  {isHttps(parsed) ? (
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <ShieldAlert className="h-4 w-4 text-amber-600" />
                  )}
                  <span className="text-sm">
                    {isHttps(parsed) ? "Secure (HTTPS)" : "Insecure (HTTP)"}
                  </span>
                </div>
                <Badge variant="outline" className="font-mono text-xs">
                  port {getEffectivePort(parsed) ?? "—"}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {parsed.searchParams.length} query {parsed.searchParams.length === 1 ? "param" : "params"}
                </Badge>
                {parsed.hash && (
                  <Badge variant="outline" className="text-xs">has fragment</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Components table */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <Label className="text-sm font-semibold">Components</Label>
              <div className="space-y-1">
                {rows.map((r) => (
                  <div
                    key={r.label}
                    className="grid grid-cols-[100px_1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0"
                  >
                    <code className="font-semibold text-foreground">{r.label}</code>
                    <code className="text-muted-foreground font-mono break-all">{r.value}</code>
                    {r.value !== "—" && r.value && (
                      <CopyButton getText={() => r.value} label="" size="icon-sm" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Full URL */}
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Full URL (canonical)</Label>
                <CopyButton getText={() => parsed.href} label="Copy" size="sm" />
              </div>
              <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
                {parsed.href}
              </pre>
            </CardContent>
          </Card>

          {/* Query params */}
          {parsed.searchParams.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-3">
                <Label className="text-sm font-semibold">Query parameters</Label>
                <div className="grid grid-cols-1 gap-2">
                  {parsed.searchParams.map((p, i) => (
                    <div
                      key={`${p.key}-${i}`}
                      className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center text-xs rounded-md border bg-muted/20 p-2"
                    >
                      <code className="font-semibold text-foreground break-all">{p.key}</code>
                      <code className="text-muted-foreground font-mono break-all">{p.value}</code>
                      <CopyButton getText={() => p.value} label="" size="icon-sm" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Safety findings (extra #2) */}
      {parsed?.isValid && safetyFindings.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Safety check ({safetyFindings.length} findings)
            </Label>
            <div className="space-y-1.5">
              {safetyFindings.map((f, i) => (
                <div key={i} className={`rounded-md border p-2 text-xs ${
                  f.severity === "high" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400" :
                  f.severity === "medium" ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400" :
                  f.severity === "low" ? "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400" :
                  "border-muted bg-muted/30 text-muted-foreground"
                }`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant="outline" className="text-[9px] uppercase bg-background/50">{f.severity}</Badge>
                    <code className="font-mono font-semibold">{f.code}</code>
                  </div>
                  <p>{f.message}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Redirect hints (extra #3) */}
      {parsed?.isValid && redirectHints.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Redirect hints</Label>
            <div className="space-y-1">
              {redirectHints.map((h, i) => (
                <div key={i} className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                  <Badge variant="outline" className="text-[9px] mr-2 bg-background/50">{h.type}</Badge>
                  {h.message}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Normalized URL (blueprint feature) */}
      {parsed?.isValid && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-primary" />
                Normalized URL
              </Label>
              <CopyButton getText={() => normalizedUrl} label="Copy" size="sm" />
            </div>
            <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
              {normalizedUrl}
            </pre>
            <p className="text-[10px] text-muted-foreground">
              Lowercased host, default port stripped, duplicate slashes removed, query params sorted.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Encoded characters (extra #4) */}
      {parsed?.isValid && encodedChars.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">Encoded characters ({encodedChars.length})</Label>
            <div className="flex flex-wrap gap-1.5">
              {encodedChars.map((e, i) => (
                <div key={i} className="rounded-md border bg-muted/20 p-1.5 text-xs">
                  <code className="font-mono text-red-600 dark:text-red-400">{e.encoded}</code>
                  <span className="mx-1 text-muted-foreground">→</span>
                  <code className="font-mono text-emerald-600 dark:text-emerald-400">{e.decoded}</code>
                  <Badge variant="outline" className="ml-1.5 text-[9px]">{e.location}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scheme info (extra #5) */}
      {parsed?.isValid && schemeInfo && (
        <Card>
          <CardContent className="p-4 space-y-1">
            <Label className="text-sm font-semibold">Scheme info</Label>
            <div className="text-xs space-y-0.5">
              <p><strong>Name:</strong> {schemeInfo.name}</p>
              <p><strong>Default port:</strong> {schemeInfo.defaultPort ?? "—"}</p>
              <p><strong>Special (has authority):</strong> {schemeInfo.isSpecial ? "Yes" : "No"}</p>
              <p className="text-muted-foreground">{schemeInfo.description}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* mailto: parser (extra #6) */}
      {mailtoParsed && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">mailto: parsed</Label>
            <div className="text-xs space-y-1">
              <p><strong>To:</strong> {mailtoParsed.to.join(", ") || "—"}</p>
              {mailtoParsed.cc && <p><strong>Cc:</strong> {mailtoParsed.cc.join(", ")}</p>}
              {mailtoParsed.bcc && <p><strong>Bcc:</strong> {mailtoParsed.bcc.join(", ")}</p>}
              {mailtoParsed.subject && <p><strong>Subject:</strong> {mailtoParsed.subject}</p>}
              {mailtoParsed.body && <p><strong>Body:</strong> {mailtoParsed.body}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* tel: parser (extra #7) */}
      {telParsed && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <Label className="text-sm font-semibold">tel: parsed</Label>
            <div className="text-xs space-y-1">
              <p><strong>Number:</strong> <code className="font-mono">{telParsed.number}</code></p>
              {telParsed.comment && <p><strong>Comment:</strong> {telParsed.comment}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* History panel (extra #1) */}
      {showHistory && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">History ({history.length})</Label>
              {history.length > 0 && (
                <button type="button" onClick={handleClearHist}
                  className="text-xs text-red-600 hover:underline cursor-pointer inline-flex items-center gap-1">
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              )}
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-muted-foreground">No history yet. Save URLs to track them.</p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {history.map((h, i) => (
                  <div key={i} className="grid grid-cols-[1fr_auto] gap-2 items-center text-xs py-1 border-b border-border/40 last:border-0">
                    <code className="font-mono break-all">{h.url}</code>
                    <button type="button" onClick={() => { setInput(h.url); setShowHistory(false); }}
                      className="text-[10px] text-primary hover:underline cursor-pointer">Load</button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!parsed && (
        <EmptyState
          title="Paste a URL to decompose"
          hint="URLs are parsed locally using the browser's native URL API. Nothing leaves your browser."
          icon={<Link2 className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> URL parsing
            happens entirely in your browser via the native <code>URL()</code>
            {" "}API. Nothing is logged or transmitted.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
