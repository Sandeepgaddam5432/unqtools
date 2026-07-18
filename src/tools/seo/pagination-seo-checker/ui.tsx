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
  parseUrlList,
  parseMetadataCsv,
  buildReport,
  filterBySeverity,
  renderTextReport,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Severity,
  type HistoryEntry,
} from "./logic";
import { History, ListOrdered, Lightbulb } from "lucide-react";

export default function PaginationSeoChecker() {
  const [urlsText, setUrlsText] = useState("");
  const [metaText, setMetaText] = useState("");
  const [severityFilter, setSeverityFilter] = useState<Severity | "all">("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.urls) setUrlsText(p.urls);
      if (p.meta) setMetaText(p.meta);
      if (p.urls || p.meta) toast.info("Loaded from share link");
    }
  }, []);

  const urls = useMemo(() => parseUrlList(urlsText), [urlsText]);
  const metadata = useMemo(() => parseMetadataCsv(metaText), [metaText]);
  const report = useMemo(() => buildReport(urls, metadata), [urls, metadata]);
  const filteredPages = useMemo(
    () => filterBySeverity(report.pages, severityFilter),
    [report.pages, severityFilter],
  );
  const textReport = useMemo(() => renderTextReport(report), [report]);
  const csvReport = useMemo(() => renderCsv(report), [report]);

  const handleSaveHistory = useCallback(() => {
    if (report.summary.totalPages > 0) {
      saveHistory({
        ts: Date.now(),
        totalUrls: report.summary.totalPages,
        totalIssues: report.summary.totalIssues,
        critical: report.summary.critical,
      });
      setHistory(loadHistory());
    }
  }, [report]);

  const handleClear = useCallback(() => {
    setUrlsText("");
    setMetaText("");
    setSeverityFilter("all");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const sevBadgeClass = (sev: Severity) =>
    sev === "critical"
      ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
      : sev === "warning"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300";

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="psc-urls">Paginated URLs (one per line, in order)</Label>
            <Textarea
              id="psc-urls"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={"https://example.com/blog/page/1\nhttps://example.com/blog/page/2\nhttps://example.com/blog/page/3"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Patterns detected: /page/N, ?page=N, ?p=N, /p/N, ?pg=N
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="psc-meta">Page metadata CSV (optional)</Label>
            <Textarea
              id="psc-meta"
              value={metaText}
              onChange={(e) => setMetaText(e.target.value)}
              placeholder={"url,rel_prev,rel_next,canonical,status_code\nhttps://example.com/page/1,,https://example.com/page/2,https://example.com/page/1,200\nhttps://example.com/page/2,https://example.com/page/1,,https://example.com/page/2,200"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground">
              Header: url,rel_prev,rel_next,canonical,status_code
            </p>
          </div>
        </CardContent>
      </Card>

      {report.summary.totalPages > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <ListOrdered className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <Stat label="Total URLs" value={report.summary.totalPages} />
                <Stat label="Pages detected" value={report.summary.totalPagesDetected} />
                <Stat label="Total issues" value={report.summary.totalIssues} />
                <Stat label="Sequence gaps" value={report.sequenceGaps.length} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Stat label="Critical" value={report.summary.critical} highlight="bad" />
                <Stat label="Warning" value={report.summary.warning} highlight="warn" />
                <Stat label="Info" value={report.summary.info} />
              </div>
              {report.sequenceGaps.length > 0 && (
                <div className="text-xs">
                  <span className="text-muted-foreground">Missing pages: </span>
                  {report.sequenceGaps.map((g) => (
                    <Badge key={g} variant="outline" className="text-[10px] mr-1">{g}</Badge>
                  ))}
                </div>
              )}
              {report.duplicateCanonicals.length > 0 && (
                <div className="text-xs space-y-1">
                  <span className="text-muted-foreground">Duplicate canonical groups:</span>
                  {report.duplicateCanonicals.map((d, i) => (
                    <div key={i} className="rounded border bg-background px-2 py-1">
                      <span className="font-mono text-[10px]">{d.canonical}</span>
                      <Badge variant="outline" className="text-[10px] ml-2">{d.count} URLs</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {report.recommendations.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lightbulb className="h-4 w-4" /> Recommendations ({report.recommendations.length})
                </h3>
                <div className="space-y-1.5">
                  {report.recommendations.map((r, i) => (
                    <div
                      key={i}
                      className={`rounded border px-3 py-1.5 text-xs ${r.severity === "critical" ? "border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300" : r.severity === "warning" ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300" : "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"}`}
                    >
                      <span className="font-mono mr-2 uppercase text-[10px]">{r.severity}</span>
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Per-URL issues ({filteredPages.length})</h3>
                <select
                  value={severityFilter}
                  onChange={(e) => setSeverityFilter(e.target.value as Severity | "all")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  <option value="all">All severities</option>
                  <option value="critical">Critical only</option>
                  <option value="warning">Warnings only</option>
                  <option value="info">Info only</option>
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredPages.map((p, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge className={`text-[10px] ${sevBadgeClass(p.severity)}`}>{p.severity}</Badge>
                      {p.pageNumber !== null && (
                        <Badge variant="outline" className="text-[10px]">page {p.pageNumber}</Badge>
                      )}
                      <span className="font-mono text-foreground truncate flex-1">{p.url}</span>
                    </div>
                    {p.issues.length > 0 ? (
                      <ul className="mt-1 space-y-0.5 text-[10px] text-muted-foreground">
                        {p.issues.map((issue, j) => (
                          <li key={j}>
                            <span className="font-mono uppercase mr-1">[{issue.severity}]</span>
                            <span className="font-mono mr-1">{issue.code}:</span>
                            {issue.message}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">✓ no issues</p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Export</h3>
              <Textarea
                readOnly
                value={textReport}
                className="min-h-[200px] resize-y font-mono text-xs"
              />
              <div className="flex flex-wrap gap-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="pagination-seo-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csvReport}
                  filename="pagination-seo-report.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(urlsText, metaText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter paginated URLs to validate SEO"
          hint="One URL per line in page order. Add metadata CSV (url,rel_prev,rel_next,canonical,status_code) to validate rel prev/next chain, canonical self-reference, and status codes."
          icon={<ListOrdered className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.totalUrls} URLs</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalIssues} issues</Badge>
                  {h.critical > 0 && (
                    <Badge variant="outline" className="mr-2 text-red-600 dark:text-red-400">{h.critical} critical</Badge>
                  )}
                  <span className="text-muted-foreground ml-2">{new Date(h.ts).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Privacy:</strong> All URL parsing and validation runs locally in your browser. History is stored in localStorage on this device only.
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
  highlight?: "bad" | "warn";
}) {
  const color = highlight === "bad"
    ? "text-red-600 dark:text-red-400"
    : highlight === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : "text-foreground";
  return (
    <div className="rounded border bg-background px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-base font-semibold ${color}`}>{value}</div>
    </div>
  );
}
