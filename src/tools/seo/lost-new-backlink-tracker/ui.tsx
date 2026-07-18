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
  parseAuto,
  diff,
  renderCsv,
  renderReport,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type HistoryEntry,
} from "./logic";
import { History, GitCompare, TrendingUp, TrendingDown, Minus, Plus } from "lucide-react";

const SAMPLE_PREV = `url,anchor,source_domain,da,link_type
https://example.com/p1,best seo tools,ahrefs.com,90,dofollow
https://example.com/p2,seo guide,moz.com,85,dofollow
https://example.com/p3,click here,spammy-site.xyz,5,nofollow
https://example.com/p4,read more,blog.example.com,40,dofollow`;

const SAMPLE_CURR = `url,anchor,source_domain,da,link_type
https://example.com/p1,best seo tools,ahrefs.com,90,dofollow
https://example.com/p3,click here,spammy-site.xyz,5,nofollow
https://example.com/p5,seo tutorial,semrush.com,88,dofollow
https://example.com/p6,best tools,neilpatel.com,82,dofollow`;

export default function LostNewBacklinkTracker() {
  const [prevText, setPrevText] = useState("");
  const [currText, setCurrText] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.prev) setPrevText(p.prev);
      if (p.curr) setCurrText(p.curr);
      if (p.prev || p.curr) toast.info("Loaded from share link");
    }
  }, []);

  const prevParsed = useMemo(() => parseAuto(prevText), [prevText]);
  const currParsed = useMemo(() => parseAuto(currText), [currText]);
  const result = useMemo(() => diff(prevParsed.backlinks, currParsed.backlinks), [prevParsed, currParsed]);
  const csv = useMemo(() => renderCsv(result), [result]);
  const report = useMemo(() => renderReport(result), [result]);

  const handleSaveHistory = useCallback(() => {
    if (result.stats.previousTotal > 0 || result.stats.currentTotal > 0) {
      saveHistory({
        ts: Date.now(),
        previousTotal: result.stats.previousTotal,
        currentTotal: result.stats.currentTotal,
        newCount: result.stats.newCount,
        lostCount: result.stats.lostCount,
        netChange: result.stats.netChange,
      });
      setHistory(loadHistory());
    }
  }, [result]);

  const handleClear = useCallback(() => {
    setPrevText("");
    setCurrText("");
    toast.info("Cleared");
  }, []);

  const handleClearHistory = useCallback(() => {
    clearHistory();
    setHistory([]);
    toast.success("History cleared");
  }, []);

  const loadSample = useCallback(() => {
    setPrevText(SAMPLE_PREV);
    setCurrText(SAMPLE_CURR);
    toast.info("Sample loaded");
  }, []);

  return (
    <div className="space-y-4 unq-animate-fade-in-up">
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Backlink exports</Label>
            <Button variant="ghost" size="sm" onClick={loadSample}>Load sample</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lnt-prev" className="text-xs flex items-center gap-1">
                <Minus className="h-3 w-3" /> Previous export (CSV or JSON)
              </Label>
              <Textarea
                id="lnt-prev"
                value={prevText}
                onChange={(e) => setPrevText(e.target.value)}
                placeholder={"url,anchor,source_domain,da,link_type\n..."}
                className="min-h-[180px] resize-y font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lnt-curr" className="text-xs flex items-center gap-1">
                <Plus className="h-3 w-3" /> Current export (CSV or JSON)
              </Label>
              <Textarea
                id="lnt-curr"
                value={currText}
                onChange={(e) => setCurrText(e.target.value)}
                placeholder={"url,anchor,source_domain,da,link_type\n..."}
                className="min-h-[180px] resize-y font-mono text-xs"
              />
            </div>
          </div>
          {(prevParsed.errors.length > 0 || currParsed.errors.length > 0) && (
            <ErrorBanner message={`Parse errors: prev ${prevParsed.errors.length}, curr ${currParsed.errors.length}`} />
          )}
        </CardContent>
      </Card>

      {(result.stats.previousTotal > 0 || result.stats.currentTotal > 0) ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <GitCompare className="h-4 w-4" /> Diff summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Previous total" value={result.stats.previousTotal} />
                <Stat label="Current total" value={result.stats.currentTotal} />
                <Stat label="Kept" value={result.stats.keptCount} highlight="good" />
                <Stat
                  label="Net change"
                  value={`${result.stats.netChange >= 0 ? "+" : ""}${result.stats.netChange}`}
                  highlight={result.stats.netChange >= 0 ? "good" : "bad"}
                />
                <Stat label="New" value={`${result.stats.newCount} (+${result.stats.newPercentage}%)`} highlight="good" />
                <Stat label="Lost" value={`${result.stats.lostCount} (-${result.stats.lostPercentage}%)`} highlight="bad" />
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> New backlinks ({result.newLinks.length})
                </h3>
                {result.newLinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No new backlinks.</p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-auto">
                    {result.newLinks.map((b, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">DA {b.da}</Badge>
                          <span className="font-mono text-foreground truncate flex-1">{b.url}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">anchor: {b.anchor || "(empty)"} · from: {b.sourceDomain}</div>
                      </div>
                    ))}
                  </div>
                )}
                {result.anchorAnalysis.newAnchors.length > 0 && (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    <strong>Top anchors:</strong> {result.anchorAnalysis.newAnchors.slice(0, 5).map((a) => `${a.anchor} (${a.count})`).join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingDown className="h-4 w-4 text-red-500" /> Lost backlinks ({result.lostLinks.length})
                </h3>
                {result.lostLinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No lost backlinks.</p>
                ) : (
                  <div className="space-y-1 max-h-[300px] overflow-auto">
                    {result.lostLinks.map((b, i) => (
                      <div key={i} className="rounded border bg-background px-3 py-1.5 text-xs">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-[10px]">DA {b.da}</Badge>
                          <span className="font-mono text-foreground truncate flex-1">{b.url}</span>
                        </div>
                        <div className="text-muted-foreground text-[11px] truncate">anchor: {b.anchor || "(empty)"} · from: {b.sourceDomain}</div>
                      </div>
                    ))}
                  </div>
                )}
                {result.anchorAnalysis.lostAnchors.length > 0 && (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    <strong>Top anchors:</strong> {result.anchorAnalysis.lostAnchors.slice(0, 5).map((a) => `${a.anchor} (${a.count})`).join(", ")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {result.topNewByDa.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-emerald-500" /> Top new by DA
                </h3>
                <div className="space-y-1">
                  {result.topNewByDa.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <Badge variant="secondary" className="text-[10px]">DA {b.da}</Badge>
                      <span className="font-mono text-foreground truncate flex-1">{b.url}</span>
                      <span className="text-muted-foreground text-[11px]">{b.sourceDomain}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-2">
            <CopyButton getText={() => { handleSaveHistory(); return csv; }} label="Copy CSV" />
            <DownloadButton getText={() => { handleSaveHistory(); return csv; }} filename="lost-new-backlinks.csv" mime="text/csv" label="Download CSV" />
            <CopyButton getText={() => report} label="Copy report" />
            <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(prevText, currText); }} />
            <ClearButton onClick={handleClear} />
          </div>
        </>
      ) : (
        <EmptyState
          title="Paste previous + current backlink exports"
          hint="Both panels accept CSV (url,anchor,source_domain,da,link_type) or JSON. Click 'Load sample' to see the diff."
          icon={<GitCompare className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.previousTotal} → {h.currentTotal}</Badge>
                  <Badge variant="outline" className="mr-2 text-emerald-700 dark:text-emerald-400">+{h.newCount}</Badge>
                  <Badge variant="outline" className="mr-2 text-red-700 dark:text-red-400">-{h.lostCount}</Badge>
                  <Badge variant="outline" className="mr-2">net {h.netChange >= 0 ? "+" : ""}{h.netChange}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> All diffing runs locally. History is stored in localStorage on this device only.
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
