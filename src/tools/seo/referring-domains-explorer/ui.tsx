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
  ErrorBanner,
} from "../../_shared";
import { toast } from "sonner";
import {
  parseInput,
  buildDomainStats,
  sortDomains,
  filterDomains,
  explore,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type SortField,
  type SortDir,
} from "./logic";
import { History, Globe, Search, ExternalLink } from "lucide-react";

const SAMPLE = `source_url,target_url,anchor,da
https://forbes.com/article-1,https://example.com/post,brand anchor,95
https://forbes.com/article-2,https://example.com/post,brand anchor,95
https://moz.com/blog/x,https://example.com/post,best seo tools,88
https://nasa.gov/press/1,https://example.com/post,official source,90
https://example.gov/news/2,https://example.com/post,gov reference,80
https://medium.com/post/y,https://example.com/post,read more,85
https://spammy-blog.xyz/post,https://example.com/post,cheap deals,5
https://youtube.com/watch,https://example.com/post,video tutorial,92
https://techcrunch.com/article,https://example.com/post,startup news,87
https://forbes.com/article-3,https://example.com/post,brand anchor,95`;

export default function ReferringDomainsExplorer() {
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("linkCount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
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

  const parsed = useMemo(() => parseInput(input), [input]);
  const result = useMemo(() => explore(parsed.rows), [parsed]);
  const sortedTop = useMemo(
    () => sortDomains(filterDomains(result.topDomains, query), sortField, sortDir),
    [result, query, sortField, sortDir],
  );
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.uniqueDomains > 0) {
      const top = result.topDomains[0];
      saveHistory({
        ts: Date.now(),
        totalBacklinks: result.totalBacklinks,
        uniqueDomains: result.uniqueDomains,
        topDomain: top?.domain ?? "",
        topDomainCount: top?.linkCount ?? 0,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
    setQuery("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const tldEntries = useMemo(
    () => Object.entries(result.tldDistribution).sort((a, b) => b[1] - a[1]),
    [result.tldDistribution],
  );

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="rde-input">Backlink data (CSV: source_url, target_url, anchor, da)</Label>
            <Button variant="ghost" size="sm" onClick={() => { setInput(SAMPLE); toast.info("Sample loaded"); }}>
              Load sample
            </Button>
          </div>
          <Textarea
            id="rde-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={"source_url,target_url,anchor,da\nhttps://forbes.com/a,https://example.com/x,brand anchor,95"}
            className="min-h-[150px] resize-y font-mono text-xs"
          />
          {parsed.errors.length > 0 && (
            <ErrorBanner message={`${parsed.errors.length} parse error(s): ${parsed.errors.slice(0, 3).join("; ")}`} />
          )}
        </CardContent>
      </Card>

      {result.uniqueDomains > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Globe className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total backlinks" value={result.totalBacklinks} />
                <Stat label="Unique domains" value={result.uniqueDomains} highlight="good" />
                <Stat label="Avg links/domain" value={result.averageLinksPerDomain} />
                <Stat label="Total anchors" value={result.totalAnchors} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <Stat label="DA high (60+)" value={result.byDaBucket.high} highlight="good" />
                <Stat label="DA med (30-59)" value={result.byDaBucket.medium} />
                <Stat label="DA low (<30)" value={result.byDaBucket.low} />
                <Stat label="DA unknown (0)" value={result.byDaBucket.unknown} />
              </div>
              <div className="text-xs text-muted-foreground pt-2">
                <strong>TLD distribution:</strong>{" "}
                {tldEntries.map(([tld, count]) => (
                  <Badge key={tld} variant="outline" className="mr-1.5 text-[10px]">.{tld}: {count}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Top referring domains</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Filter..."
                      className="h-8 pl-7 text-xs w-40"
                    />
                  </div>
                  <select
                    value={sortField}
                    onChange={(e) => setSortField(e.target.value as SortField)}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    aria-label="Sort field"
                  >
                    <option value="linkCount">Sort: link count</option>
                    <option value="domain">Sort: domain</option>
                    <option value="daEstimate">Sort: DA estimate</option>
                    <option value="tld">Sort: TLD</option>
                  </select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                    className="h-8 text-xs"
                  >
                    {sortDir === "asc" ? "↑ asc" : "↓ desc"}
                  </Button>
                </div>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {sortedTop.map((s, i) => (
                  <div key={s.domain} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">#{i + 1}</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{s.domain}</span>
                      <Badge variant="outline" className="text-[10px]">.{s.tld}</Badge>
                      <Badge variant="outline" className="text-[10px]">DA ~{s.daEstimate}</Badge>
                      <Badge variant="outline" className="text-[10px]">{s.linkCount} link{s.linkCount !== 1 ? "s" : ""}</Badge>
                    </div>
                    {s.anchors.length > 0 && (
                      <div className="text-muted-foreground text-[11px]">
                        <strong>Anchors:</strong> {s.anchors.slice(0, 5).join("; ")}
                        {s.anchors.length > 5 ? ` (+${s.anchors.length - 5} more)` : ""}
                      </div>
                    )}
                    <div className="text-muted-foreground text-[11px] truncate">
                      <strong>Sample URL:</strong>{" "}
                      <a
                        href={s.sourceUrls[0]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-0.5 align-baseline"
                      >
                        {s.sourceUrls[0]}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
                <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="referring-domains.csv" mime="text/csv" label="Download CSV" />
                <CopyButton getText={() => report} label="Copy report" />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(input); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste backlink data to explore referring domains"
          hint="CSV with columns: source_url, target_url, anchor, da. Click 'Load sample' to see unique domains, link counts, DA estimates, and TLD distribution."
          icon={<Globe className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.uniqueDomains} domains</Badge>
                  <Badge variant="outline" className="mr-2">{h.totalBacklinks} links</Badge>
                  <span className="text-muted-foreground">
                    Top: <strong className="text-foreground">{h.topDomain}</strong> ({h.topDomainCount} links)
                  </span>
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
            <strong className="text-foreground">Privacy:</strong> All domain extraction runs locally. History is stored in localStorage on this device only.
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
