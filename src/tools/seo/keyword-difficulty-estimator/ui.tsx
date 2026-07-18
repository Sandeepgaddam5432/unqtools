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
  parseBulk,
  analyzeBulk,
  sortResults,
  renderCsv,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type SortField,
  type SortDir,
  type HistoryEntry,
} from "./logic";
import { History, Gauge, ArrowDownUp, TrendingUp, TrendingDown } from "lucide-react";

const DIFF_COLORS: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  Medium: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
  Hard: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  "Very Hard": "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
};

export default function KeywordDifficultyEstimator() {
  const [bulkText, setBulkText] = useState("");
  const [sortField, setSortField] = useState<SortField>("difficulty");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
    if (typeof window !== "undefined" && window.location.hash) {
      const p = parseShareUrl(window.location.hash);
      if (p.keywords) {
        setBulkText(p.keywords);
        toast.info("Loaded from share link");
      }
    }
  }, []);

  const keywords = useMemo(() => parseBulk(bulkText), [bulkText]);
  const bulk = useMemo(() => analyzeBulk(keywords), [keywords]);
  const sorted = useMemo(
    () => sortResults(bulk.results, sortField, sortDir),
    [bulk.results, sortField, sortDir],
  );
  const csv = useMemo(() => renderCsv(bulk), [bulk]);

  const handleSaveHistory = useCallback(() => {
    if (bulk.total > 0) {
      saveHistory({
        ts: Date.now(),
        keywordCount: bulk.total,
        averageDifficulty: bulk.averageDifficulty,
        snippet: sorted[0]?.keyword ?? "",
      });
      setHistory(loadHistory());
    }
  }, [bulk.total, bulk.averageDifficulty, sorted]);

  const handleClear = useCallback(() => {
    setBulkText("");
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
            <Label htmlFor="kde-bulk">Keywords (one per line or comma-separated)</Label>
            <Textarea
              id="kde-bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"seo\nwhat is seo\nbest seo tools\nbuy cheap shoes"}
              className="min-h-[120px] resize-y font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      {bulk.total > 0 ? (
        <>
          <Card>
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                <Gauge className="h-4 w-4" /> Summary
              </h3>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">{bulk.total} keywords</Badge>
                <Badge variant="outline">avg difficulty: {bulk.averageDifficulty}</Badge>
                {(["Easy", "Medium", "Hard", "Very Hard"] as const).map((cat) =>
                  bulk.categoryDistribution[cat] > 0 ? (
                    <span
                      key={cat}
                      className={`rounded border px-2 py-0.5 text-xs ${DIFF_COLORS[cat]}`}
                    >
                      {cat}: {bulk.categoryDistribution[cat]}
                    </span>
                  ) : null,
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">Per-keyword breakdown</h3>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <ArrowDownUp className="h-3 w-3" /> Sort:
                  </span>
                  {(["difficulty", "opportunity", "keyword"] as SortField[]).map((f) => (
                    <Button
                      key={f}
                      size="sm"
                      variant={sortField === f ? "default" : "outline"}
                      onClick={() => setSortField(f)}
                      className="h-7 text-xs"
                    >
                      {f}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    className="h-7 text-xs gap-1"
                  >
                    {sortDir === "asc" ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    {sortDir}
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[500px] overflow-auto">
                {sorted.map((r, i) => (
                  <div key={i} className="rounded border bg-background p-3 text-xs space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-mono text-foreground flex-1 min-w-0 truncate">{r.keyword}</div>
                      <span className={`rounded border px-2 py-0.5 ${DIFF_COLORS[r.category]}`}>
                        {r.difficulty} · {r.category}
                      </span>
                      <Badge variant="secondary">opp: {r.opportunity}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 text-muted-foreground">
                      {r.factors.map((f, j) => (
                        <div key={j} className="rounded border bg-muted/40 px-1.5 py-1">
                          <div className="font-medium text-foreground text-[10px]">{f.label}</div>
                          <div className={f.value > 0 ? "text-red-600 dark:text-red-400" : f.value < 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>
                            {f.value > 0 ? "+" : ""}{f.value}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="text-foreground text-xs italic">{r.recommendation}</div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <CopyButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  label="Copy CSV"
                />
                <DownloadButton
                  getText={() => {
                    handleSaveHistory();
                    return csv;
                  }}
                  filename="keyword-difficulty.csv"
                  mime="text/csv"
                  label="Download CSV"
                />
                <ShareButton
                  getUrl={() => {
                    handleSaveHistory();
                    return buildShareUrl(bulkText);
                  }}
                />
                <ClearButton onClick={handleClear} />
              </div>
            </CardContent>
          </Card>
        </>
      ) : (
        <EmptyState
          title="Enter keywords to estimate difficulty"
          hint="Each keyword is scored 0-100 from word count, commercial intent, brand presence, and modifier signals."
          icon={<Gauge className="h-8 w-8" />}
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
                  <Badge variant="outline" className="mr-2">{h.keywordCount} keywords</Badge>
                  <Badge variant="outline" className="mr-2">avg {h.averageDifficulty}</Badge>
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
            <strong className="text-foreground">Privacy:</strong> Difficulty
            estimation runs locally using algorithmic heuristics — not live SERP
            data. Use as a relative indicator. History is stored in localStorage
            on this device only.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
