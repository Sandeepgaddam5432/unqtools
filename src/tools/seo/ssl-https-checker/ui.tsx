"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  CopyButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  analyze,
  renderReport,
  estimateHttpsRedirect,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type Rating,
} from "./logic";
import { History, Lock, AlertTriangle, CheckCircle2, XCircle, Info } from "lucide-react";

const RATING_COLORS: Record<Rating, string> = {
  pass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  fail: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

const RATING_ICONS: Record<Rating, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};

export default function SslHttpsChecker() {
  const [url, setUrl] = useState("");
  const [html, setHtml] = useState("");
  const [hsts, setHsts] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.url !== undefined) {
        setUrl(p.url);
        if (p.html !== undefined) setHtml(p.html);
        if (p.hsts !== undefined) setHsts(p.hsts);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => analyze(url, html, hsts), [url, html, hsts]);
  const report = useMemo(() => renderReport(result), [result]);
  const redirectUrl = useMemo(() => estimateHttpsRedirect(url), [url]);

  const handleSaveHistory = useCallback(() => {
    if (url.trim()) {
      saveHistory({
        ts: Date.now(),
        url: url.trim(),
        score: result.score,
        rating: result.rating,
        isHttps: result.isHttps,
        mixedContentCount: result.mixedContent.length,
      });
      setHistory(loadHistory());
    }
  }, [url, result]);

  const handleClear = useCallback(() => {
    setUrl("");
    setHtml("");
    setHsts("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ssl-url">URL to check *</Label>
            <Input
              id="ssl-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ssl-html">HTML (optional — for mixed content check)</Label>
            <Textarea
              id="ssl-html"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              placeholder={"<!DOCTYPE html>\n<html>\n<body>\n  <img src=\"http://insecure.com/x.jpg\">\n</body>\n</html>"}
              className="min-h-[100px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ssl-hsts">Strict-Transport-Security header value (optional)</Label>
            <Input
              id="ssl-hsts"
              value={hsts}
              onChange={(e) => setHsts(e.target.value)}
              placeholder="max-age=31536000; includeSubDomains; preload"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Paste the value of the Strict-Transport-Security response header (without the header name).
            </p>
          </div>
        </CardContent>
      </Card>

      {url.trim() ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="h-4 w-4" /> SSL & HTTPS score
                </h3>
                <Badge className={`text-base font-bold ${RATING_COLORS[result.rating]}`}>
                  {result.score}/100 · {result.rating}
                </Badge>
                {result.isHttps ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="h-3 w-3 mr-0.5" /> HTTPS
                  </Badge>
                ) : result.isHttp ? (
                  <Badge variant="destructive">
                    <XCircle className="h-3 w-3 mr-0.5" /> HTTP (insecure)
                  </Badge>
                ) : (
                  <Badge variant="outline">{result.protocol ?? "unknown"}</Badge>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <Stat label="Pass" value={result.passCount} highlight="good" />
                <Stat label="Warn" value={result.warnCount} highlight={result.warnCount > 0 ? "bad" : undefined} />
                <Stat label="Fail" value={result.failCount} highlight={result.failCount > 0 ? "bad" : undefined} />
              </div>
              {result.isHttp && redirectUrl && (
                <div className="rounded border border-amber-500/30 bg-amber-500/10 p-2 text-xs">
                  <div className="font-medium text-amber-700 dark:text-amber-400">HTTP → HTTPS redirect</div>
                  <div className="mt-1">
                    Upgrade to: <code className="font-mono text-foreground">{redirectUrl}</code>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Checks</h3>
              <div className="space-y-2">
                {result.checks.map((c) => {
                  const Icon = RATING_ICONS[c.rating];
                  return (
                    <div key={c.name} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${RATING_COLORS[c.rating]}`}>
                          <Icon className="h-3 w-3 mr-0.5" />
                          {c.rating}
                        </Badge>
                        <span className="font-medium text-foreground">{c.label}</span>
                        <Badge variant="secondary" className="text-[10px] ml-auto">+{c.score} pts</Badge>
                      </div>
                      <div className="text-muted-foreground">{c.details}</div>
                      {c.rating !== "pass" && (
                        <div className="text-amber-700 dark:text-amber-400 italic">{c.recommendation}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {result.mixedContent.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-red-500" /> Mixed content ({result.mixedContent.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {result.mixedContent.map((m, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={m.severity === "active" ? "destructive" : "outline"} className="text-[10px]">
                          {m.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{m.type}</Badge>
                        <code className="font-mono text-foreground truncate flex-1">{m.src}</code>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.hstsInfo && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">HSTS analysis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <Stat label="max-age" value={result.hstsInfo.maxAge ?? "(missing)"} />
                  <Stat label="includeSubDomains" value={result.hstsInfo.includeSubDomains ? "yes" : "no"} highlight={result.hstsInfo.includeSubDomains ? "good" : "bad"} />
                  <Stat label="preload" value={result.hstsInfo.preload ? "yes" : "no"} highlight={result.hstsInfo.preload ? "good" : "bad"} />
                  <Stat label="valid" value={result.hstsInfo.valid ? "yes" : "no"} highlight={result.hstsInfo.valid ? "good" : "bad"} />
                </div>
                {result.hstsInfo.issues.length > 0 && (
                  <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-0.5 list-disc list-inside pt-1">
                    {result.hstsInfo.issues.map((iss, i) => <li key={i}>{iss}</li>)}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Info className="h-4 w-4" /> Recommendations ({result.recommendations.length})
                </h3>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl({ url, html, hsts }); }} />
            <ClearButton onClick={handleClear} />
          </div>

          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>Honest disclaimer:</strong> This tool does NOT make live HTTPS requests. It analyzes URL structure, mixed content in pasted HTML, and HSTS from pasted header data. For live certificate verification, use SSL Labs (ssllabs.com/ssltest) or curl from your terminal.
              </p>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter a URL to check SSL & HTTPS"
          hint="Paste a URL (http or https). Optionally paste HTML to check for mixed content, and/or the HSTS header value to validate. The tool analyzes structure — no live requests are made."
          icon={<Lock className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>Clear</Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setUrl(h.url); toast.info(`Loaded ${h.url}`); }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <Badge variant="outline" className={`mr-2 ${RATING_COLORS[h.rating as Rating]}`}>{h.score}/100</Badge>
                  {h.isHttps ? (
                    <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">HTTPS</Badge>
                  ) : (
                    <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">HTTP</Badge>
                  )}
                  {h.mixedContentCount > 0 && (
                    <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">{h.mixedContentCount} mixed</Badge>
                  )}
                  <code className="font-mono text-[11px]">{h.url}</code>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All analysis runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: "bad" | "good";
}) {
  const color = highlight === "good"
    ? "text-emerald-600 dark:text-emerald-400"
    : highlight === "bad"
      ? "text-red-600 dark:text-red-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
