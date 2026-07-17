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
  analyze,
  renderReport,
  buildBarData,
  buildShareUrl,
  parseShareUrl,
  loadHistory,
  saveHistory,
  clearHistory,
  type HistoryEntry,
} from "./logic";
import { History, BarChart3, FileCode, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

export default function HtmlToTextRatioChecker() {
  const [html, setHtml] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const parsed = parseShareUrl(window.location.hash);
      if (parsed.html !== undefined) {
        setHtml(parsed.html);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const result = useMemo(() => analyze(html), [html]);
  const barData = useMemo(() => buildBarData(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.stats.htmlSize > 0) {
      saveHistory({
        ts: Date.now(),
        htmlSize: result.stats.htmlSize,
        ratio: result.stats.ratio,
        wordCount: result.stats.wordCount,
        score: result.score,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setHtml("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const totalSize = barData.reduce((sum, d) => sum + d.value, 0) || 1;

  const scoreColor = (score: number): string => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-2">
          <Label htmlFor="htrc-html">Paste your HTML</Label>
          <Textarea
            id="htrc-html"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder={"<!DOCTYPE html>\n<html>\n<head><title>...</title></head>\n<body>\n  <h1>Article Title</h1>\n  <p>Content here...</p>\n</body>\n</html>"}
            className="min-h-[200px] font-mono text-xs resize-y"
          />
        </CardContent>
      </Card>

      {result.stats.htmlSize > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Stats</h3>
                <div className="text-right">
                  <div className="text-xs text-muted-foreground">SEO score</div>
                  <div className={`text-2xl font-bold ${scoreColor(result.score)}`}>
                    {result.score}<span className="text-sm">/100</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">HTML size</div>
                  <div className="text-lg font-semibold">{result.stats.htmlSize.toLocaleString()} <span className="text-xs font-normal">bytes</span></div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Text size</div>
                  <div className="text-lg font-semibold">{result.stats.textSize.toLocaleString()} <span className="text-xs font-normal">bytes</span></div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Ratio</div>
                  <div className={`text-lg font-semibold ${scoreColor(result.score)}`}>
                    {result.stats.ratio.toFixed(1)}%
                  </div>
                </div>
                <div className="rounded-md border bg-background/50 p-2">
                  <div className="text-xs text-muted-foreground">Words</div>
                  <div className="text-lg font-semibold">{result.stats.wordCount}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Text vs markup visualization</h3>
              <div className="flex h-8 w-full overflow-hidden rounded-md border bg-muted/30">
                {barData.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      width: `${(d.value / totalSize) * 100}%`,
                      backgroundColor: d.color,
                    }}
                    className="flex items-center justify-center text-xs font-medium text-white transition-all"
                    title={`${d.label}: ${d.value} bytes`}
                  >
                    {d.value / totalSize > 0.1 && (
                      <span>{((d.value / totalSize) * 100).toFixed(0)}%</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3 text-xs">
                {barData.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: d.color }} />
                    {d.label}: {d.value.toLocaleString()} bytes
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Tag breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Total tags</span>
                  <Badge variant="outline">{result.stats.tagCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Scripts</span>
                  <Badge variant="outline">{result.stats.scriptCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Styles</span>
                  <Badge variant="outline">{result.stats.styleCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Images</span>
                  <Badge variant="outline">{result.stats.imgCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Links</span>
                  <Badge variant="outline">{result.stats.linkCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Headings</span>
                  <Badge variant="outline">{result.stats.headingCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Paragraphs</span>
                  <Badge variant="outline">{result.stats.paragraphCount}</Badge>
                </div>
                <div className="flex items-center justify-between rounded border px-2 py-1">
                  <span className="text-muted-foreground">Lists</span>
                  <Badge variant="outline">{result.stats.listCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Recommendations</h3>
                <div className="space-y-2">
                  {result.recommendations.map((r, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-md border p-2 text-xs ${
                        r.level === "good"
                          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
                          : r.level === "warning"
                            ? "border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400"
                            : "border-red-500/30 bg-red-500/5 text-red-700 dark:text-red-400"
                      }`}
                    >
                      {r.level === "good" ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : r.level === "warning" ? (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {result.text && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label>Extracted text ({result.text.length} chars)</Label>
                  <CopyButton getText={() => result.text} label="Copy text" size="icon-sm" />
                </div>
                <pre className="overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-xs max-h-[200px]">
                  {result.text}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return report; }} label="Copy report" />
            <DownloadButton
              getText={() => report}
              filename="html-text-ratio-report.md"
              label="Download .md"
            />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(html); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste HTML to analyze"
          hint="Paste a full HTML document or fragment. We'll extract the visible text, compute the HTML-to-text ratio, count tags and words, and give you SEO recommendations."
          icon={<BarChart3 className="h-8 w-8" />}
        />
      )}

      {history.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-4 w-4" /> Recent ({history.length})
              </h3>
              <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                Clear
              </Button>
            </div>
            <div className="space-y-1">
              {history.slice(0, 5).map((h, i) => (
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex items-center justify-between">
                  <div>
                    <Badge variant="outline" className="mr-2">{h.ratio.toFixed(1)}%</Badge>
                    <span className="text-muted-foreground">{h.wordCount} words</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${scoreColor(h.score)}`}>{h.score}</span>
                    <span className="text-muted-foreground/70">{new Date(h.ts).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All HTML
            parsing and analysis runs locally. History is stored in localStorage
            on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
