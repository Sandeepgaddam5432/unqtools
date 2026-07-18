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
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  analyze,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type LinkType,
} from "./logic";
import { History, Unlink, ExternalLink, AlertCircle } from "lucide-react";

const SAMPLE = `<!DOCTYPE html>
<html>
<body>
  <h1>Sample Page</h1>
  <nav>
    <a href="/home">Home</a>
    <a href="/about">About</a>
    <a href="https://forbes.com/article">Forbes</a>
    <a href="https://moz.com/blog">Moz</a>
    <a href="https://forbes.com/another">Forbes 2</a>
  </nav>
  <main>
    <p>Check our <a href="javascript:void(0)">JS link</a> and <a href="#">anchor</a>.</p>
    <p>Empty link: <a href="">click</a></p>
    <p>Mail: <a href="mailto:hello@example.com">Email us</a></p>
    <p>External: <a href="example.com" target="_blank" rel="nofollow">No protocol</a></p>
  </main>
</body>
</html>`;

const TYPE_COLORS: Record<LinkType, string> = {
  internal: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  external: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  anchor: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  mailto: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  tel: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30",
  javascript: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  empty: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  "relative-no-base": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export default function BrokenLinkChecker() {
  const [input, setInput] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        if (p.base) setBaseUrl(p.base);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => analyze(input, baseUrl || undefined), [input, baseUrl]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        total: result.total,
        internal: result.byType.internal,
        external: result.byType.external,
        issuesCount: result.issuesCount,
        linksWithIssues: result.linksWithIssues,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
    setBaseUrl("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const linksWithIssues = result.links.filter((l) => l.issues.length > 0);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="blc-input">HTML content</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); setBaseUrl("https://example.com"); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="blc-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"<!DOCTYPE html>\n<html>\n<body>\n  <a href=\"/about\">About</a>\n  <a href=\"https://forbes.com\">Forbes</a>\n</body>\n</html>"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          <div>
            <Label htmlFor="blc-base" className="text-xs">Base URL (optional — for resolving relative links)</Label>
            <Input
              id="blc-base"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-8 text-xs font-mono"
            />
          </div>
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Unlink className="h-4 w-4" /> Summary ({result.total} links)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total links" value={result.total} />
                <Stat label="Internal" value={result.byType.internal} highlight="good" />
                <Stat label="External" value={result.byType.external} />
                <Stat label="Anchor (#)" value={result.byType.anchor} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <Stat label="Mailto/Tel" value={result.byType.mailto + result.byType.tel} />
                <Stat label="JavaScript" value={result.byType.javascript} highlight={result.byType.javascript > 0 ? "bad" : undefined} />
                <Stat label="Empty" value={result.byType.empty} highlight={result.byType.empty > 0 ? "bad" : undefined} />
                <Stat label="No base" value={result.byType["relative-no-base"]} highlight={result.byType["relative-no-base"] > 0 ? "bad" : undefined} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs pt-1">
                <Stat label="Total issues" value={result.issuesCount} highlight={result.issuesCount > 0 ? "bad" : "good"} />
                <Stat label="Links with issues" value={result.linksWithIssues} highlight={result.linksWithIssues > 0 ? "bad" : "good"} />
                <Stat label="Unique external domains" value={result.uniqueDomains} />
              </div>
              {result.topExternalDomains.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2">
                  <strong>Top external domains:</strong>{" "}
                  {result.topExternalDomains.slice(0, 5).map((d) => (
                    <Badge key={d.domain} variant="outline" className="mr-1.5 text-[10px]">
                      {d.domain} ({d.count})
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {linksWithIssues.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-500" /> Links with issues ({linksWithIssues.length})
                </h3>
                <div className="space-y-1 max-h-[300px] overflow-auto">
                  {linksWithIssues.map((l, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[l.type]}`}>{l.type}</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{l.href || "(empty)"}</span>
                      </div>
                      {l.text && <div className="text-muted-foreground text-[11px]">text: {l.text}</div>}
                      <div className="space-y-0.5">
                        {l.issues.map((iss, j) => (
                          <div
                            key={j}
                            className={`text-[11px] ${iss.severity === "error" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}
                          >
                            [{iss.severity}] {iss.message} → {iss.recommendation}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">All links</h3>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {result.links.map((l, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[l.type]}`}>{l.type}</Badge>
                      {l.targetBlank && <Badge variant="outline" className="text-[10px]">_blank</Badge>}
                      {l.relAttributes.length > 0 && (
                        <Badge variant="outline" className="text-[10px]">rel={l.relAttributes.join(",")}</Badge>
                      )}
                      <a
                        href={l.resolvedUrl ?? l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-foreground truncate flex-1 hover:underline inline-flex items-center gap-0.5"
                      >
                        {l.href || "(empty)"}
                        {l.type === "external" && <ExternalLink className="h-3 w-3 flex-shrink-0" />}
                      </a>
                    </div>
                    {l.text && <div className="text-muted-foreground text-[11px] mt-0.5">text: {l.text}</div>}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="link-report.csv" mime="text/csv" label="Download CSV" />
                <CopyButton getText={() => report} label="Copy report" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input, baseUrl); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to check links"
          hint="Paste HTML containing <a> tags. Optionally provide a base URL for resolving relative links. The tool extracts links, classifies them, and detects common issues."
          icon={<Unlink className="h-8 w-8" />}
        />
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Note:</strong> This tool checks for syntactic and structural link issues — it does NOT make HTTP requests to verify links resolve. Use it as a pre-flight scan before running a server-side crawler.
          </p>
        </CardContent>
      </Card>

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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.total} links</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">{h.internal} internal</Badge>
                  <Badge variant="outline" className="mr-2 text-blue-700 dark:text-blue-400">{h.external} external</Badge>
                  <Badge variant="outline" className="mr-2 text-amber-700 dark:text-amber-400">{h.linksWithIssues} issues</Badge>
                  <div className="text-muted-foreground/70 mt-1">{new Date(h.ts).toLocaleString()}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All HTML parsing runs locally. History is stored in localStorage on this device only.
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
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
