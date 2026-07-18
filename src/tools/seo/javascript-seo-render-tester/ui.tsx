"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CopyButton,
  DownloadButton,
  EmptyState,
  ShareButton,
  ClearButton,
} from "../../_shared";
import { toast } from "sonner";
import {
  analyzeInputs,
  filterBlocking,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type Severity,
} from "./logic";
import { CodeXml, History, FileText, AlertTriangle, CheckCircle2, Info, Zap } from "lucide-react";

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 60) return "text-amber-600 dark:text-amber-400";
  if (score >= 40) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function scoreBgClass(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (score >= 60) return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (score >= 40) return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
}

function severityIcon(sev: Severity): React.ReactNode {
  if (sev === "critical") return <AlertTriangle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
  if (sev === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />;
  if (sev === "info") return <Info className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
  return null;
}

export default function JavascriptSeoRenderTester() {
  const [htmlText, setHtmlText] = useState("");
  const [jsList, setJsList] = useState("");
  const [blockingOnly, setBlockingOnly] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.html || p.jsList) {
        setHtmlText(p.html);
        setJsList(p.jsList);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => analyzeInputs(htmlText, jsList), [htmlText, jsList]);
  const filteredScripts = useMemo(
    () => filterBlocking(result.scripts, blockingOnly),
    [result.scripts, blockingOnly],
  );
  const textReport = useMemo(() => renderTextReport(result), [result]);
  const csv = useMemo(() => renderCsv(filteredScripts), [filteredScripts]);

  const handleSaveHistory = useCallback(() => {
    if (result.summary.totalScripts > 0 || result.summary.missingCriticalTags > 0) {
      saveHistory({
        ts: Date.now(),
        scriptCount: result.summary.totalScripts,
        blockingCount: result.summary.blockingCount,
        renderScore: result.summary.renderScore,
      });
      setHistory(loadHistory());
    }
  }, [result.summary]);

  const handleClear = useCallback(() => {
    setHtmlText("");
    setJsList("");
    setBlockingOnly(false);
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const hasInput = htmlText.trim().length > 0 || jsList.trim().length > 0;

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="jsrt-html">HTML snippet (head + initial body)</Label>
            <Textarea
              id="jsrt-html"
              value={htmlText}
              onChange={(e) => setHtmlText(e.target.value)}
              placeholder={"<!DOCTYPE html>\n<html>\n<head>\n  <script src=\"/app.js\"></script>\n</head>\n<body>\n  <div id=\"root\"></div>\n</body>\n</html>"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jsrt-js">JS files (one per line; URL or &lt;script&gt; tag; trailing attributes OK)</Label>
            <Textarea
              id="jsrt-js"
              value={jsList}
              onChange={(e) => setJsList(e.target.value)}
              placeholder={"/vendor.js defer\n/app.js\n<script src=\"/analytics.js\" async></script>"}
              className="min-h-[80px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {hasInput ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CodeXml className="h-4 w-4" /> Summary
                </h3>
                <div className={`px-3 py-1 rounded-md text-xs font-semibold ${scoreBgClass(result.renderScore)}`}>
                  Render score: {result.renderScore}/100
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total scripts" value={result.summary.totalScripts} />
                <Stat label="External" value={result.externalCount} />
                <Stat label="Inline" value={result.inlineCount} />
                <Stat label="Render-blocking" value={result.blockingCount} highlight={result.blockingCount > 0 ? "bad" : "good"} />
                <Stat label="Missing title" value={result.missingTitle ? "yes" : "no"} highlight={result.missingTitle ? "bad" : "good"} />
                <Stat label="Missing meta desc" value={result.missingMetaDescription ? "yes" : "no"} highlight={result.missingMetaDescription ? "bad" : "good"} />
                <Stat label="Missing H1" value={result.missingH1 ? "yes" : "no"} highlight={result.missingH1 ? "bad" : "good"} />
                <Stat label="Render score" value={`${result.renderScore}/100`} highlight={result.renderScore >= 80 ? "good" : result.renderScore < 60 ? "bad" : undefined} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Zap className="h-4 w-4" /> DOM after render simulation
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">&lt;title&gt;</div>
                  <div className={`font-mono ${result.domSummary.title ? "text-foreground" : "text-red-600 dark:text-red-400"}`}>
                    {result.domSummary.title ?? "(missing)"}
                  </div>
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">meta description</div>
                  <div className={`font-mono truncate ${result.domSummary.metaDescription ? "text-foreground" : "text-red-600 dark:text-red-400"}`}>
                    {result.domSummary.metaDescription ?? "(missing)"}
                  </div>
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">&lt;h1&gt; count</div>
                  <div className={`font-mono ${result.domSummary.h1Count > 0 ? "text-foreground" : "text-red-600 dark:text-red-400"}`}>
                    {result.domSummary.h1Count}
                  </div>
                  {result.domSummary.h1s.length > 0 && (
                    <div className="text-[10px] text-muted-foreground mt-1 truncate">
                      e.g. {result.domSummary.h1s[0]}
                    </div>
                  )}
                </div>
                <div className="rounded border bg-background px-3 py-2">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">&lt;a&gt; link count</div>
                  <div className="font-mono text-foreground">{result.domSummary.linkCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" /> Recommendations ({result.recommendations.length})
                </h3>
                <div className="space-y-1 max-h-[280px] overflow-auto">
                  {result.recommendations.map((r, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-start gap-2">
                      <div className="mt-0.5">{severityIcon(r.severity)}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] font-semibold text-foreground">{r.code}</span>
                          <Badge variant="outline" className="text-[10px]">{r.severity}</Badge>
                        </div>
                        <div className="text-[11px] text-foreground/80 mt-0.5">{r.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Scripts ({filteredScripts.length})
                </h3>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockingOnly}
                    onChange={(e) => setBlockingOnly(e.target.checked)}
                  />
                  Show blocking only
                </label>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-auto">
                {filteredScripts.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-3 text-center">
                    <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-600 dark:text-emerald-400" />
                    No scripts match the current filter
                  </div>
                ) : (
                  filteredScripts.map((s, i) => {
                    const blocking = s.inHead && !s.async && !s.defer && !s.isInline;
                    return (
                      <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-foreground truncate flex-1">
                            {s.isInline ? "(inline script)" : (s.src ?? "(no src)")}
                          </span>
                          {blocking && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300">
                              BLOCKING
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded text-[10px] bg-muted text-foreground">
                            {s.inHead ? "head" : "body"}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {s.async && <Badge variant="outline" className="text-[10px]">async</Badge>}
                          {s.defer && <Badge variant="outline" className="text-[10px]">defer</Badge>}
                          {s.type && <Badge variant="outline" className="text-[10px]">type={s.type}</Badge>}
                          {s.isInline && <Badge variant="outline" className="text-[10px]">inline</Badge>}
                          {!s.isInline && <Badge variant="outline" className="text-[10px]">external</Badge>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="js-render-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="js-render-scripts.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(htmlText, jsList); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste HTML and JS files to test JS SEO rendering"
          hint="Add an HTML snippet (head + body) and/or a list of JS files. The tool detects render-blocking scripts, simulates the post-JS DOM, and computes a 0-100 render score."
          icon={<CodeXml className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap gap-2">
                  <Badge variant="outline">{h.scriptCount} scripts</Badge>
                  {h.blockingCount > 0 && <Badge variant="outline" className="text-red-700 dark:text-red-400">{h.blockingCount} blocking</Badge>}
                  <span className={`font-mono ${scoreColor(h.renderScore)}`}>score: {h.renderScore}</span>
                  <span className="text-muted-foreground ml-auto">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All HTML parsing and JS analysis runs locally in your browser. History is stored in localStorage on this device only. No network calls.
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
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
