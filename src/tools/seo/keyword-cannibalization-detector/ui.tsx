"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CopyButton, DownloadButton, EmptyState, ShareButton, ClearButton } from "../../_shared";
import { toast } from "sonner";
import {
  parseEntries,
  buildReport,
  renderMarkdown,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, GitMerge, AlertTriangle, ShieldCheck } from "lucide-react";

const SEVERITY_STYLES: Record<string, string> = {
  high: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  low: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
};

export default function KeywordCannibalizationDetector() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.input) {
        setInput(p.input);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const entries = useMemo(() => parseEntries(input), [input]);
  const report = useMemo(() => buildReport(entries), [entries]);
  const markdown = useMemo(() => renderMarkdown(report), [report]);
  const csv = useMemo(() => renderCsv(report), [report]);

  const handleSaveHistory = useCallback(() => {
    if (entries.length > 0) {
      saveHistory({
        ts: Date.now(),
        totalEntries: report.totalEntries,
        highSeverityCount: report.highSeverityCount,
        mediumSeverityCount: report.mediumSeverityCount,
        clusterCount: report.clusters.length,
      });
      setHistory(loadHistory());
    }
  }, [entries.length, report]);

  const handleClear = useCallback(() => {
    setInput("");
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
          <div className="space-y-1.5">
            <Label htmlFor="kc-input">Pages — one per line, format: URL,keyword</Label>
            <Textarea
              id="kc-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"https://example.com/seo-guide,SEO tools\nhttps://example.com/best-seo,SEO tools\nhttps://example.com/marketing,content marketing"}
              className="min-h-[160px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{entries.length} parsed</Badge>
            <Badge variant="outline">{report.uniqueKeywords} unique keywords</Badge>
            <Badge variant="outline">{report.cleanEntries} clean</Badge>
            {report.highSeverityCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {report.highSeverityCount} high
              </Badge>
            )}
            {report.mediumSeverityCount > 0 && (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
                {report.mediumSeverityCount} medium
              </Badge>
            )}
            {report.lowSeverityCount > 0 && (
              <Badge variant="secondary">{report.lowSeverityCount} low</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {entries.length > 0 ? (
        report.clusters.length > 0 ? (
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <GitMerge className="h-4 w-4" /> Cannibalization clusters
                </h3>
                <div className="flex gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return markdown;
                    }}
                    label="Copy MD"
                  />
                  <DownloadButton getText={() => markdown} filename="cannibalization-report.md" mime="text/markdown" label="MD" />
                  <DownloadButton getText={() => csv} filename="cannibalization-report.csv" mime="text/csv" label="CSV" />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl(input);
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-2">
                {report.clusters.map((c, i) => (
                  <div
                    key={i}
                    className={`rounded border p-3 text-xs space-y-2 ${SEVERITY_STYLES[c.severity]}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold uppercase">{c.severity} · "{c.keyword}"</div>
                      <Badge variant="outline">{c.count} URLs</Badge>
                    </div>
                    <ul className="list-disc list-inside space-y-0.5">
                      {c.urls.map((u, j) => (
                        <li key={j} className="font-mono break-all">{u}</li>
                      ))}
                    </ul>
                    <div className="opacity-90">{c.recommendation}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
                <span>No cannibalization detected. Every keyword maps to one URL.</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl(input);
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        )
      ) : (
        <EmptyState
          title="Paste URLs + keywords to detect cannibalization"
          hint="We'll find keywords targeted by multiple pages and recommend merge / canonicalize / differentiate actions."
          icon={<GitMerge className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                  <Badge variant="outline" className="mr-2">{h.totalEntries} entries</Badge>
                  <Badge variant="outline" className="mr-2">{h.clusterCount} clusters</Badge>
                  {h.highSeverityCount > 0 && (
                    <Badge variant="destructive" className="mr-2">{h.highSeverityCount} high</Badge>
                  )}
                  <span className="text-muted-foreground">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> cannibalization detection runs locally. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
