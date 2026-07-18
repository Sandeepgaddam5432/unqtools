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
  BLOAT_THRESHOLD,
  parseUrlList,
  analyzeUrls,
  filterByRecommendation,
  renderTextReport,
  renderCsv,
  renderRobotsTxt,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RecommendationType,
  type HistoryEntry,
} from "./logic";
import { Filter, History, FileText, ShieldAlert } from "lucide-react";

const REC_LABELS: Record<RecommendationType | "all", string> = {
  "all": "All recommendations",
  "self-canonical": "Self-canonical",
  "canonical-to-base": "Canonical-to-base",
  "block-in-robots": "Block in robots.txt",
};

const REC_BADGE_CLASS: Record<RecommendationType, string> = {
  "self-canonical": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  "canonical-to-base": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "block-in-robots": "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function FacetedNavSeoAnalyzer() {
  const [urlsText, setUrlsText] = useState("");
  const [filterType, setFilterType] = useState<RecommendationType | "all">("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.urls) {
        setUrlsText(p.urls);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const urls = useMemo(() => parseUrlList(urlsText), [urlsText]);
  const result = useMemo(() => analyzeUrls(urls), [urls]);
  const filteredRecs = useMemo(
    () => filterByRecommendation(result.recommendations, filterType),
    [result.recommendations, filterType],
  );
  const textReport = useMemo(() => renderTextReport(result), [result]);
  const csv = useMemo(() => renderCsv(filteredRecs), [filteredRecs]);
  const robotsTxt = useMemo(() => renderRobotsTxt(result.robotsRules), [result.robotsRules]);

  const handleSaveHistory = useCallback(() => {
    if (result.summary.totalUrls > 0) {
      saveHistory({
        ts: Date.now(),
        urlCount: result.summary.totalUrls,
        basePathsCount: result.summary.basePaths,
        duplicateGroups: result.summary.duplicateContentCount,
        bloatGroups: result.summary.bloatCount,
      });
      setHistory(loadHistory());
    }
  }, [result.summary]);

  const handleClear = useCallback(() => {
    setUrlsText("");
    setFilterType("all");
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
        <CardContent className="p-4 space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="fn-urls">Faceted URLs (one per line)</Label>
            <Textarea
              id="fn-urls"
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={"https://example.com/products?color=red&size=m\nhttps://example.com/products?color=red&size=l\nhttps://example.com/products?color=blue&size=m\nhttps://example.com/products?size=m&color=red"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Parameter bloat threshold: <strong>{BLOAT_THRESHOLD}</strong> combinations per base path.
            </p>
          </div>
        </CardContent>
      </Card>

      {result.summary.totalUrls > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Filter className="h-4 w-4" /> Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <Stat label="Total URLs" value={result.summary.totalUrls} />
                <Stat label="Base paths" value={result.summary.basePaths} />
                <Stat label="Distinct params" value={result.summary.totalParams} />
                <Stat label="Duplicate-content groups" value={result.summary.duplicateContentCount} highlight={result.summary.duplicateContentCount > 0 ? "bad" : "good"} />
                <Stat label="Parameter-bloat groups" value={result.summary.bloatCount} highlight={result.summary.bloatCount > 0 ? "bad" : "good"} />
                <Stat label="Self-canonical" value={result.summary.recommendationsByType["self-canonical"]} />
                <Stat label="Canonical-to-base" value={result.summary.recommendationsByType["canonical-to-base"]} highlight={result.summary.recommendationsByType["canonical-to-base"] > 0 ? "bad" : undefined} />
                <Stat label="Block in robots" value={result.summary.recommendationsByType["block-in-robots"]} highlight={result.summary.recommendationsByType["block-in-robots"] > 0 ? "bad" : undefined} />
              </div>
            </CardContent>
          </Card>

          {result.paramTable.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">URL parameter table</h3>
                <div className="space-y-1 max-h-[200px] overflow-auto">
                  {result.paramTable.map((p) => (
                    <div key={p.name} className="flex items-center gap-2 rounded border bg-background px-3 py-1.5 text-xs">
                      <span className="font-mono font-medium text-foreground">{p.name}</span>
                      <Badge variant="secondary" className="text-[10px]">{p.distinctValuesCount} value(s)</Badge>
                      <span className="text-muted-foreground text-[10px] truncate">e.g. {p.exampleValues.join(", ")}</span>
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
                  <FileText className="h-4 w-4" /> Recommendations ({filteredRecs.length})
                </h3>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as RecommendationType | "all")}
                  className="h-8 text-xs rounded border bg-background px-2"
                >
                  {(Object.keys(REC_LABELS) as (RecommendationType | "all")[]).map((t) => (
                    <option key={t} value={t}>{REC_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {filteredRecs.map((r, i) => (
                  <div key={i} className="rounded border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${REC_BADGE_CLASS[r.recommendation]}`}>
                        {REC_LABELS[r.recommendation]}
                      </span>
                      <span className="font-mono text-foreground truncate flex-1">{r.raw}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground pl-1">
                      <span className="font-mono text-[10px]">{r.basePath}</span>
                      {r.params && <span className="ml-2">params: <span className="font-mono">{r.params}</span></span>}
                    </div>
                    <div className="text-[11px] text-foreground/80 pl-1">{r.reason}</div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  label="Copy report"
                />
                <DownloadButton
                  getText={() => { handleSaveHistory(); return textReport; }}
                  filename="faceted-nav-report.txt"
                  mime="text/plain"
                  label="Download .txt"
                />
                <DownloadButton
                  getText={() => csv}
                  filename="faceted-nav-recommendations.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <CopyButton
                  getText={() => robotsTxt}
                  label="Copy robots.txt"
                />
                <DownloadButton
                  getText={() => robotsTxt}
                  filename="robots-suggestions.txt"
                  mime="text/plain"
                  label="Download robots.txt"
                />
                <ShareButton getUrl={() => { handleSaveHistory(); return buildShareUrl(urlsText); }} />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>

          {result.robotsRules.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4" /> Suggested robots.txt
                </h3>
                <pre className="text-[11px] font-mono bg-muted/30 rounded p-2 overflow-auto max-h-[200px]">{robotsTxt}</pre>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Paste faceted URLs to analyze"
          hint="One URL per line. The tool will group by base path, count parameter combinations, detect duplicate content (same params, different order), and flag parameter bloat."
          icon={<Filter className="h-8 w-8" />}
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
                  <Badge variant="outline">{h.urlCount} URLs</Badge>
                  <Badge variant="outline">{h.basePathsCount} base paths</Badge>
                  {h.duplicateGroups > 0 && <Badge variant="outline" className="text-amber-700 dark:text-amber-400">{h.duplicateGroups} dup groups</Badge>}
                  {h.bloatGroups > 0 && <Badge variant="outline" className="text-red-700 dark:text-red-400">{h.bloatGroups} bloated</Badge>}
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
            <strong className="text-foreground">Privacy:</strong> All URL parsing and analysis runs locally in your browser. History is stored in localStorage on this device only. No network calls.
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
