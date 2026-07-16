"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  analyzeCanonical,
  buildAllTags,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type CanonicalInput,
  type CanonicalFinding,
  type HistoryEntry,
} from "./logic";
import { History, Link2, Globe, AlertTriangle } from "lucide-react";

const SEVERITY_STYLES: Record<CanonicalFinding["severity"], string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
  info: "border-muted bg-muted/30 text-muted-foreground",
};

export default function CanonicalTagGenerator() {
  const [input, setInput] = useState<CanonicalInput>({
    canonicalUrl: "",
    pageUrl: "",
    prevUrl: "",
    nextUrl: "",
    stripTrackingParams: true,
  });
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (Object.keys(parsed).length > 0) {
        setInput((prev) => ({ ...prev, ...parsed } as CanonicalInput));
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const analysis = useMemo(() => analyzeCanonical(input), [input]);
  const output = useMemo(() => {
    if (!input.canonicalUrl.trim()) return "";
    return buildAllTags(input);
  }, [input]);

  const batchResults = useMemo(() => {
    if (!batchMode) return [];
    const urls = batchUrls.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return [];
    // Inline import would be cleaner — but using analyzeBatch from logic
    return urls.map((u) => {
      const a = analyzeCanonical({ canonicalUrl: u, stripTrackingParams: input.stripTrackingParams });
      return { url: u, normalized: a.normalizedUrl, tag: a.tag, findings: a.findings };
    });
  }, [batchMode, batchUrls, input.stripTrackingParams]);

  const update = useCallback(<K extends keyof CanonicalInput>(key: K, val: CanonicalInput[K]) => {
    setInput((prev) => ({ ...prev, [key]: val }));
  }, []);

  const handleCopy = useCallback(() => {
    if (output && analysis.tag) {
      saveHistory({ ts: Date.now(), url: input.canonicalUrl, tag: analysis.tag });
      setHistory(loadHistory());
    }
  }, [output, input.canonicalUrl, analysis.tag]);

  const handleClear = useCallback(() => {
    setInput({ canonicalUrl: "", pageUrl: "", prevUrl: "", nextUrl: "", stripTrackingParams: true });
    setBatchUrls("");
    toast.info("Form cleared");
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
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">URLs</h3>
            <Button
              size="sm"
              variant={batchMode ? "default" : "outline"}
              onClick={() => setBatchMode((m) => !m)}
            >
              {batchMode ? "Single URL mode" : "Batch mode"}
            </Button>
          </div>
          {!batchMode ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="can-url">Canonical URL *</Label>
                <Input
                  id="can-url"
                  value={input.canonicalUrl}
                  onChange={(e) => update("canonicalUrl", e.target.value)}
                  placeholder="https://example.com/page"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="can-page">Current page URL (optional)</Label>
                <Input
                  id="can-page"
                  value={input.pageUrl}
                  onChange={(e) => update("pageUrl", e.target.value)}
                  placeholder="https://example.com/actual-page"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="can-prev">Previous page URL (optional)</Label>
                  <Input
                    id="can-prev"
                    value={input.prevUrl}
                    onChange={(e) => update("prevUrl", e.target.value)}
                    placeholder="https://example.com/page-1"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="can-next">Next page URL (optional)</Label>
                  <Input
                    id="can-next"
                    value={input.nextUrl}
                    onChange={(e) => update("nextUrl", e.target.value)}
                    placeholder="https://example.com/page-3"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="can-strip"
                  checked={!!input.stripTrackingParams}
                  onCheckedChange={(v) => update("stripTrackingParams", v)}
                />
                <Label htmlFor="can-strip" className="text-sm cursor-pointer">
                  Strip tracking params (utm_*, gclid, fbclid)
                </Label>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="can-batch">URLs (one per line)</Label>
              <Textarea
                id="can-batch"
                value={batchUrls}
                onChange={(e) => setBatchUrls(e.target.value)}
                placeholder={"https://example.com/page1\nhttps://example.com/page2"}
                className="min-h-[120px] font-mono text-xs resize-y"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {!batchMode && input.canonicalUrl && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">URL analysis</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded border bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Absolute</div>
                <div className={`font-semibold ${analysis.isAbsolute ? "text-emerald-600" : "text-red-600"}`}>
                  {analysis.isAbsolute ? "Yes" : "No"}
                </div>
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">HTTPS</div>
                <div className={`font-semibold ${analysis.isHttps ? "text-emerald-600" : "text-amber-600"}`}>
                  {analysis.isHttps ? "Yes" : "No"}
                </div>
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">www</div>
                <div className="font-semibold">{analysis.hasWww ? "Yes" : "No"}</div>
              </div>
              <div className="rounded border bg-muted/30 p-2">
                <div className="text-xs text-muted-foreground">Trailing /</div>
                <div className="font-semibold">{analysis.hasTrailingSlash ? "Yes" : "No"}</div>
              </div>
            </div>
            <div className="space-y-1 pt-2">
              <div className="text-xs text-muted-foreground">Normalized URL</div>
              <div className="font-mono text-xs break-all">{analysis.normalizedUrl}</div>
            </div>
            {analysis.findings.length > 0 && (
              <div className="space-y-1 pt-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Findings ({analysis.findings.length})
                </div>
                {analysis.findings.map((f, i) => (
                  <div key={i} className={`rounded border p-2 text-xs ${SEVERITY_STYLES[f.severity]}`}>
                    <div className="font-medium">{f.message}</div>
                    <div className="opacity-80">{f.recommendation}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {batchMode && batchResults.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Batch results</h3>
            {batchResults.map((r, i) => (
              <div key={i} className="rounded border bg-background p-2 space-y-1 text-xs">
                <div className="font-mono break-all">{r.url}</div>
                <div className="font-mono text-emerald-600 dark:text-emerald-400 break-all">→ {r.normalized}</div>
                {r.tag && <div className="font-mono text-muted-foreground break-all">{r.tag}</div>}
                {r.findings.length > 0 && (
                  <div className="text-amber-600 dark:text-amber-400">
                    {r.findings.length} finding(s): {r.findings.map((f) => f.message).join("; ")}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {output ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Generated tags</Label>
            <div className="flex flex-wrap gap-2">
              <CopyButton getText={() => { handleCopy(); return output; }} />
              <DownloadButton getText={() => output} filename="canonical-tags.html" mime="text/html" />
              <ShareButton getUrl={() => buildShareUrl(input)} />
              <ClearButton onClick={handleClear} />
            </div>
          </div>
          <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs break-all">
            {output}
          </pre>
        </div>
      ) : (
        <EmptyState
          title="Enter a canonical URL to generate tags"
          hint="The page URL is optional but helps detect cross-domain / www / slash mismatches."
          icon={<Link2 className="h-8 w-8" />}
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
                  onClick={() => {
                    setInput((prev) => ({ ...prev, canonicalUrl: h.url }));
                    toast.info("Loaded URL from history");
                  }}
                  className="block w-full text-left rounded border bg-background px-3 py-2 text-xs hover:bg-muted/50 transition-colors cursor-pointer break-all"
                >
                  <Globe className="h-3 w-3 inline mr-1" />
                  <span className="font-mono">{h.url}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> canonical tag generation runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
