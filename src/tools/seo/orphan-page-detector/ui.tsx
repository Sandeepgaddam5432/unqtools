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
  parseUrlList,
  parseInternalLinks,
  buildReport,
  renderTextTable,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
  type UrlEntry,
} from "./logic";
import {
  History,
  Unlink,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

export default function OrphanPageDetector() {
  const [urlsInput, setUrlsInput] = useState("");
  const [linksInput, setLinksInput] = useState("");
  const [filter, setFilter] = useState<"all" | "orphans">("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.urls || p.links) {
        setUrlsInput(p.urls);
        setLinksInput(p.links);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const urls = useMemo(() => parseUrlList(urlsInput), [urlsInput]);
  const links = useMemo(() => parseInternalLinks(linksInput), [linksInput]);
  const report = useMemo(() => buildReport(urls, links), [urls, links]);
  const textTable = useMemo(() => renderTextTable(report.entries), [report.entries]);
  const csv = useMemo(() => renderCsv(report.entries), [report.entries]);

  const filtered = useMemo(
    () => (filter === "orphans" ? report.entries.filter((e) => e.isOrphan) : report.entries),
    [report.entries, filter],
  );

  const handleSaveHistory = useCallback(() => {
    if (report.totalUrls > 0) {
      saveHistory({
        ts: Date.now(),
        totalUrls: report.totalUrls,
        totalLinks: report.totalLinks,
        orphanCount: report.orphanCount,
        linkedCount: report.linkedCount,
      });
      setHistory(loadHistory());
    }
  }, [report]);

  const handleClear = useCallback(() => {
    setUrlsInput("");
    setLinksInput("");
    setFilter("all");
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
            <Label htmlFor="op-urls">All URLs on your site — one per line</Label>
            <Textarea
              id="op-urls"
              value={urlsInput}
              onChange={(e) => setUrlsInput(e.target.value)}
              placeholder={"https://example.com/\nhttps://example.com/about\nhttps://example.com/blog/seo-tips\nhttps://example.com/contact"}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="op-links">
              Internal links found — plain URLs or <code>&lt;a href="…"&gt;text&lt;/a&gt;</code> (one per line)
            </Label>
            <Textarea
              id="op-links"
              value={linksInput}
              onChange={(e) => setLinksInput(e.target.value)}
              placeholder={'https://example.com/\n<a href="https://example.com/about">About us</a>\n<a href="/blog/seo-tips">SEO tips</a>'}
              className="min-h-[140px] resize-y font-mono text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{report.totalUrls} URLs</Badge>
            <Badge variant="outline">{report.totalLinks} links</Badge>
            <Badge variant="outline">{report.internalLinks} internal</Badge>
            <Badge variant="outline">avg {report.avgLinksPerUrl}/URL</Badge>
            {report.orphanCount > 0 && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="h-3 w-3" /> {report.orphanCount} orphans
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {report.totalUrls > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded border p-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                  <div className="text-[10px] uppercase tracking-wide opacity-80">Linked</div>
                  <div className="text-xl font-bold">{report.linkedCount}</div>
                </div>
                <div className="rounded border p-2 border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400">
                  <div className="text-[10px] uppercase tracking-wide opacity-80">Orphans</div>
                  <div className="text-xl font-bold">{report.orphanCount}</div>
                </div>
                <div className="rounded border p-2 border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400">
                  <div className="text-[10px] uppercase tracking-wide opacity-80">Most linked</div>
                  <div className="text-xl font-bold">{report.maxLinks}</div>
                </div>
                <div className="rounded border p-2 border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400">
                  <div className="text-[10px] uppercase tracking-wide opacity-80">Avg/URL</div>
                  <div className="text-xl font-bold">{report.avgLinksPerUrl}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs">Filter:</Label>
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                  className="text-xs"
                >
                  All ({report.totalUrls})
                </Button>
                <Button
                  size="sm"
                  variant={filter === "orphans" ? "destructive" : "outline"}
                  onClick={() => setFilter("orphans")}
                  className="text-xs"
                >
                  Orphans only ({report.orphanCount})
                </Button>
              </div>
            </CardContent>
          </Card>

          {report.topLinked.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> Top {report.topLinked.length} linked pages
                </h3>
                <div className="space-y-1">
                  {report.topLinked.map((e, i) => (
                    <RankRow key={`t-${i}`} entry={e} rank={i + 1} variant="top" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {report.bottomLinked.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4" /> Bottom {report.bottomLinked.length} linked pages
                </h3>
                <div className="space-y-1">
                  {report.bottomLinked.map((e, i) => (
                    <RankRow key={`b-${i}`} entry={e} rank={i + 1} variant="bottom" />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Unlink className="h-4 w-4" /> All URLs ({filtered.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  <CopyButton
                    getText={() => {
                      handleSaveHistory();
                      return textTable;
                    }}
                    label="Copy TXT"
                  />
                  <DownloadButton getText={() => textTable} filename="orphan-page-report.txt" mime="text/plain" label="TXT" />
                  <DownloadButton getText={() => csv} filename="orphan-page-report.csv" mime="text/csv" label="CSV" />
                  <ShareButton
                    getUrl={() => {
                      handleSaveHistory();
                      return buildShareUrl(urlsInput, linksInput);
                    }}
                  />
                  <ClearButton onClick={handleClear} />
                </div>
              </div>
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {filtered.map((e, i) => (
                  <UrlRow key={i} entry={e} />
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Paste URLs + internal links to find orphan pages"
          hint="Orphans are pages with zero internal links pointing to them — bad for crawl discovery and link equity. We'll list every URL with its inbound link count."
          icon={<Unlink className="h-8 w-8" />}
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
                <div key={i} className="rounded border bg-background px-3 py-2 text-xs flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline">{h.totalUrls} URLs</Badge>
                  <Badge variant="outline">{h.totalLinks} links</Badge>
                  {h.orphanCount > 0 && <Badge variant="destructive">{h.orphanCount} orphans</Badge>}
                  <Badge variant="outline">{h.linkedCount} linked</Badge>
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
            <strong className="text-foreground">Privacy:</strong> orphan detection runs entirely in your browser. No URL list is uploaded. History is stored in localStorage on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function RankRow({ entry, rank, variant }: { entry: UrlEntry; rank: number; variant: "top" | "bottom" }) {
  const isOrphan = entry.isOrphan;
  const styles =
    isOrphan
      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
      : variant === "top"
        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
  return (
    <div className={`rounded border px-3 py-2 text-xs flex items-center gap-2 ${styles}`}>
      <span className="font-bold w-6 text-center">#{rank}</span>
      <span className="font-mono break-all flex-1">{entry.normalized}</span>
      <Badge variant="outline" className="shrink-0">{entry.count} links</Badge>
    </div>
  );
}

function UrlRow({ entry }: { entry: UrlEntry }) {
  const styles = entry.isOrphan
    ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  return (
    <div className={`rounded border p-3 text-xs space-y-1.5 ${styles}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono break-all">{entry.normalized}</div>
        <Badge variant="outline" className="shrink-0">
          {entry.isOrphan ? "ORPHAN" : `${entry.count} links`}
        </Badge>
      </div>
      {entry.anchorTexts.length > 0 && (
        <div className="opacity-90">
          <span className="opacity-70">Anchor texts:</span>{" "}
          {entry.anchorTexts.map((t, i) => (
            <span key={i} className="font-mono mr-1">
              "{t}"{i < entry.anchorTexts.length - 1 ? "," : ""}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
