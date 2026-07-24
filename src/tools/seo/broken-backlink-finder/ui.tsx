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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  STATUS_CODE_REFERENCE,
  parseCsv,
  scoreAll,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, Link2Off, AlertTriangle, CheckCircle2, Skull } from "lucide-react";

const SAMPLE = `url,status_code,anchor,source_url,source_domain
https://example.com/old-post,404,best seo tools,https://forbes.com/article-1,forbes.com
https://example.com/another,410,brand anchor,https://moz.com/blog,moz.com
https://example.com/server-error,500,read more,https://medium.com/post,medium.com
https://example.com/forbidden,403,gated content,https://cnn.com/news,cnn.com
https://example.com/healthy,200,brand anchor,https://techcrunch.com/a,techcrunch.com
https://example.com/redirected,301,brand,https://bbc.com/news,bbc.com
https://example.com/dead-2,404,click here,https://wired.com/a,wired.com
https://example.com/server-err-2,503,review,https://verge.com/b,verge.com`;

const CATEGORY_COLORS: Record<string, string> = {
  "2xx": "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  "3xx": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
  "4xx": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  "5xx": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
  unknown: "bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/30",
};

export default function BrokenBacklinkFinder() {
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.data) {
        setInput(p.data);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const parsed = useMemo(() => parseCsv(input), [input]);
  const result = useMemo(() => scoreAll(parsed.entries), [parsed]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.total > 0) {
      saveHistory({
        ts: Date.now(),
        total: result.total,
        broken: result.broken,
        healthy: result.healthy,
        averageOpportunity: result.averageOpportunity,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
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
          <div className="flex items-center justify-between">
            <Label htmlFor="bbf-input">Backlink data with status codes (CSV)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="bbf-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"url,status_code,anchor,source_url,source_domain\nhttps://example.com/old,404,brand anchor,https://forbes.com/a,forbes.com"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
        </CardContent>
      </Card>

      {result.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Link2Off className="h-4 w-4" /> Summary ({result.total} links)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total" value={result.total} />
                <Stat label="Broken" value={result.broken} highlight={result.broken > 0 ? "bad" : "good"} />
                <Stat label="Healthy" value={result.healthy} highlight="good" />
                <Stat label="Avg opportunity" value={result.averageOpportunity} highlight={result.averageOpportunity >= 60 ? "good" : undefined} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs pt-1">
                <Stat label="2xx OK" value={result.byCategory["2xx"]} />
                <Stat label="3xx redirects" value={result.byCategory["3xx"]} />
                <Stat label="4xx client err" value={result.byCategory["4xx"]} highlight={result.byCategory["4xx"] > 0 ? "bad" : undefined} />
                <Stat label="5xx server err" value={result.byCategory["5xx"]} highlight={result.byCategory["5xx"] > 0 ? "bad" : undefined} />
                <Stat label="Unknown" value={result.byCategory.unknown} />
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                <strong>Unique broken source domains:</strong> {result.uniqueBrokenDomains}
              </div>
            </CardContent>
          </Card>

          {result.topOpportunities.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Skull className="h-4 w-4 text-red-500" /> Top reclamation opportunities ({result.topOpportunities.length})
                </h3>
                <div className="space-y-1 max-h-[400px] overflow-auto">
                  {result.topOpportunities.map((e, i) => (
                    <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="destructive" className="text-[10px]">{e.statusCode}</Badge>
                        <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[e.category]}`}>{e.category}</Badge>
                        <Badge variant="secondary" className="text-[10px]">score {e.opportunityScore}</Badge>
                        <span className="font-mono text-foreground truncate flex-1">{e.url}</span>
                      </div>
                      {e.anchor && (
                        <div className="text-muted-foreground text-[11px]">
                          anchor: <strong className="text-foreground">{e.anchor}</strong>
                          {e.sourceDomain && <> · from: <strong className="text-foreground">{e.sourceDomain}</strong></>}
                        </div>
                      )}
                      <div className="text-amber-700 dark:text-amber-400 text-[11px] italic">{e.recommendation}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">All backlinks</h3>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {result.all.map((e, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[e.category]}`}>
                        {e.isBroken ? <AlertTriangle className="h-3 w-3 mr-0.5" /> : <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                        {e.statusCode}
                      </Badge>
                      <span className="font-mono text-foreground truncate flex-1">{e.url}</span>
                      {e.isBroken && <Badge variant="secondary" className="text-[10px]">score {e.opportunityScore}</Badge>}
                    </div>
                    <div className="text-muted-foreground text-[11px]">
                      {e.anchor ? `anchor: ${e.anchor}` : "(no anchor)"}
                      {e.sourceDomain ? ` · from ${e.sourceDomain}` : ""}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="broken-backlinks.csv" mime="text/csv" label="Download CSV" />
                <CopyButton getText={() => report} label="Copy report" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Status code reference</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 max-h-[300px] overflow-auto">
                {Object.entries(STATUS_CODE_REFERENCE).map(([code, info]) => (
                  <div key={code} className="rounded border bg-background px-2 py-1 text-[11px]">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[info.category]}`}>{code}</Badge>
                      <span className="font-medium text-foreground">{info.label}</span>
                      {info.isBroken && <Badge variant="destructive" className="text-[10px]">broken</Badge>}
                    </div>
                    <div className="text-muted-foreground mt-0.5">{info.description}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste backlink data with status codes"
          hint="CSV with columns: url, status_code, anchor, source_url, source_domain. Click 'Load sample' to see broken links and reclamation opportunities."
          icon={<Link2Off className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.total} links</Badge>
                  <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">{h.broken} broken</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">{h.healthy} healthy</Badge>
                  <span className="text-muted-foreground">avg opp {h.averageOpportunity}</span>
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
